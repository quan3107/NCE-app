/**
 * Location: src/lib/auth-session.ts
 * Purpose: Own auth session state, persistence, and live-session application.
 * Why: Keeps AuthProvider focused on user-facing auth actions and context values.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { setAuthenticatedQueryScope } from './authenticated-query-scope';
import { useCommitLiveProfile } from './auth-profile-session';
import {
  clearAuthenticatedQueries,
  synchronizeProfileCache,
} from './auth-query-session';
import { loadInitialState, mapBackendUser } from './auth-state';
import type {
  AuthSuccessResponse,
  LiveUser,
  PersistSnapshot,
  RefreshPromiseSlot,
  SessionIdentity,
  SessionVersion,
} from './auth-types';
import {
  loadSharedAuthSnapshot,
  persistSharedAuthSnapshot,
  subscribeToSharedAuth,
  type SharedAuthSnapshot,
} from './shared-auth-session';

export const useAuthSession = () => {
  const initial = useMemo(loadInitialState, []);
  const [liveUser, setLiveUser] = useState<LiveUser | null>(initial.liveUser);
  const liveUserRef = useRef<LiveUser | null>(initial.liveUser);
  const sessionGenerationRef = useRef(initial.liveUser ? 1 : 0);
  const sessionEpochRef = useRef(initial.sessionEpoch);
  const profileRevisionRef = useRef(initial.profileRevision);
  const userRevisionRef = useRef(initial.liveUser ? 1 : 0);
  const profileCommitSequenceRef = useRef(new Map<string, number>());
  const tokenRef = useRef<string | null>(initial.token);
  const refreshPromiseRef = useRef<RefreshPromiseSlot | null>(null);
  const shouldRefreshOnMountRef = useRef(
    Boolean(initial.token || initial.liveUser),
  );
  setAuthenticatedQueryScope({
    generation: sessionGenerationRef.current,
    userId: liveUserRef.current?.id ?? null,
  });

  const consumeSharedSession = useCallback((snapshot: SharedAuthSnapshot) => {
    const isProfileRevision =
      snapshot.sessionEpoch === sessionEpochRef.current &&
      snapshot.profileRevision > profileRevisionRef.current &&
      snapshot.liveUser?.id === liveUserRef.current?.id &&
      snapshot.liveUser?.role === liveUserRef.current?.role;
    sessionEpochRef.current = snapshot.sessionEpoch;
    profileRevisionRef.current = snapshot.profileRevision;
    if (isProfileRevision && snapshot.liveUser) {
      userRevisionRef.current += 1;
      tokenRef.current = snapshot.token;
      liveUserRef.current = snapshot.liveUser;
      setLiveUser(snapshot.liveUser);
      synchronizeProfileCache(snapshot.liveUser);
      return;
    }
    sessionGenerationRef.current += 1;
    userRevisionRef.current += 1;
    tokenRef.current = snapshot.token;
    liveUserRef.current = snapshot.liveUser;
    refreshPromiseRef.current = null;
    profileCommitSequenceRef.current.clear();
    setAuthenticatedQueryScope({
      generation: sessionGenerationRef.current,
      userId: snapshot.liveUser?.id ?? null,
    });
    setLiveUser(snapshot.liveUser);
    clearAuthenticatedQueries();
  }, []);

  const persistState = useCallback(
    (snapshot: PersistSnapshot, advanceEpoch = false) => {
      const result = persistSharedAuthSnapshot(
        snapshot,
        sessionEpochRef.current,
        advanceEpoch,
        { token: tokenRef.current, liveUser: liveUserRef.current },
        profileRevisionRef.current,
        false,
      );
      if (
        result.status !== 'committed' &&
        result.status !== 'fallback' &&
        result.status !== 'volatile'
      ) {
        if (result.status === 'stale') consumeSharedSession(result.snapshot);
        return false;
      }
      sessionEpochRef.current = result.snapshot.sessionEpoch;
      profileRevisionRef.current = result.snapshot.profileRevision;
      return true;
    },
    [consumeSharedSession],
  );

  const persistProfileState = useCallback(
    (snapshot: PersistSnapshot) => {
      const result = persistSharedAuthSnapshot(
        snapshot,
        sessionEpochRef.current,
        false,
        { token: tokenRef.current, liveUser: liveUserRef.current },
        profileRevisionRef.current,
        true,
      );
      if (result.status === 'stale') {
        consumeSharedSession(result.snapshot);
        return false;
      }
      sessionEpochRef.current = result.snapshot.sessionEpoch;
      profileRevisionRef.current = result.snapshot.profileRevision;
      return true;
    },
    [consumeSharedSession],
  );

  const clearSession = useCallback(() => {
    persistState(
      {
        token: null,
        liveUser: null,
      },
      true,
    );
    sessionGenerationRef.current += 1;
    userRevisionRef.current += 1;
    tokenRef.current = null;
    liveUserRef.current = null;
    refreshPromiseRef.current = null;
    profileCommitSequenceRef.current.clear();
    setAuthenticatedQueryScope({
      generation: sessionGenerationRef.current,
      userId: null,
    });
    setLiveUser(null);
    clearAuthenticatedQueries();
  }, [persistState]);

  const getSessionVersion = useCallback(
    (): SessionVersion => ({
      generation: sessionGenerationRef.current,
      sessionEpoch: sessionEpochRef.current,
      userRevision: userRevisionRef.current,
      userId: liveUserRef.current?.id ?? null,
    }),
    [],
  );

  const getAdmissionSessionVersion = useCallback((): SessionVersion => {
    const shared = loadSharedAuthSnapshot();
    if (
      shared.sessionEpoch > sessionEpochRef.current ||
      (shared.sessionEpoch === sessionEpochRef.current &&
        shared.profileRevision > profileRevisionRef.current)
    ) {
      consumeSharedSession(shared);
    }
    return {
      generation: sessionGenerationRef.current,
      sessionEpoch: sessionEpochRef.current,
      userRevision: userRevisionRef.current,
      userId: liveUserRef.current?.id ?? null,
    };
  }, [consumeSharedSession]);

  const applyLiveSession = useCallback(
    (payload: AuthSuccessResponse, expectedVersion?: SessionVersion) => {
      const nextUser = mapBackendUser(payload.user);
      const previousUser = liveUserRef.current;
      if (
        expectedVersion &&
        (expectedVersion.generation !== sessionGenerationRef.current ||
          expectedVersion.sessionEpoch !== sessionEpochRef.current ||
          expectedVersion.userId !== (previousUser?.id ?? null))
      ) {
        return false;
      }

      const replacesIdentity = previousUser?.id !== nextUser.id;
      const userChangedSinceRequest =
        expectedVersion &&
        !replacesIdentity &&
        expectedVersion.userRevision !== userRevisionRef.current;
      const resolvedNextUser =
        userChangedSinceRequest && previousUser
          ? { ...nextUser, name: previousUser.name }
          : nextUser;
      const replacesAuthorization =
        replacesIdentity || previousUser?.role !== resolvedNextUser.role;

      if (
        !persistState(
          { token: payload.accessToken, liveUser: resolvedNextUser },
          replacesAuthorization,
        )
      ) {
        return false;
      }

      if (replacesAuthorization) {
        profileCommitSequenceRef.current.clear();
        sessionGenerationRef.current += 1;
        setAuthenticatedQueryScope({
          generation: sessionGenerationRef.current,
          userId: resolvedNextUser.id,
        });
        clearAuthenticatedQueries();
      } else {
        synchronizeProfileCache(resolvedNextUser);
      }
      userRevisionRef.current += 1;
      tokenRef.current = payload.accessToken;
      liveUserRef.current = resolvedNextUser;
      setLiveUser(resolvedNextUser);
      return true;
    },
    [persistState],
  );

  const updateLiveUser = useCallback(
    (
      expected: SessionIdentity,
      updates: Partial<Pick<LiveUser, 'name'>>,
    ): boolean => {
      const current = liveUserRef.current;
      if (
        !current ||
        current.id !== expected.userId ||
        sessionGenerationRef.current !== expected.generation
      ) {
        return false;
      }

      const nextUser = { ...current, ...updates };
      if (!persistProfileState({ token: tokenRef.current, liveUser: nextUser })) {
        return false;
      }
      userRevisionRef.current += 1;
      liveUserRef.current = nextUser;
      setLiveUser(nextUser);
      return true;
    },
    [persistProfileState],
  );

  const commitLiveProfile = useCommitLiveProfile({
    clearSession,
    liveUserRef,
    persistProfileState,
    profileCommitSequenceRef,
    sessionGenerationRef,
    setLiveUser,
    tokenRef,
    userRevisionRef,
  });

  useEffect(
    () =>
      subscribeToSharedAuth(
        sessionEpochRef.current,
        consumeSharedSession,
        profileRevisionRef.current,
      ),
    [consumeSharedSession],
  );

  return {
    liveUser,
    sessionGeneration: sessionGenerationRef.current,
    tokenRef,
    refreshPromiseRef,
    shouldRefreshOnMountRef,
    getSessionVersion,
    getAdmissionSessionVersion,
    applyLiveSession,
    updateLiveUser,
    commitLiveProfile,
    clearSession,
  };
};
