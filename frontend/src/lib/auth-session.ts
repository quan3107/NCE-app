/**
 * Location: src/lib/auth-session.ts
 * Purpose: Own auth session state, persistence, and live-session application.
 * Why: Keeps AuthProvider focused on user-facing auth actions and context values.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { queryClient } from './queryClient';
import { setAuthenticatedQueryScope } from './authenticated-query-scope';
import {
  clearAuthenticatedQueries,
  synchronizeProfileCache,
} from './auth-query-session';
import { loadInitialState, mapBackendUser } from './auth-state';
import type {
  AuthSuccessResponse,
  CurrentProfile,
  LiveUser,
  PersistSnapshot,
  RefreshAccessTokenResult,
  SessionIdentity,
} from './auth-types';
import {
  loadSharedAuthSnapshot,
  persistSharedAuthSnapshot,
  subscribeToSharedAuth,
  type SharedAuthSnapshot,
} from './shared-auth-session';

type SessionVersion = {
  generation: number;
  sessionEpoch: number;
  userRevision: number;
  userId: string | null;
};

type RefreshPromiseSlot = {
  generation: number;
  promise: Promise<RefreshAccessTokenResult>;
};

export const useAuthSession = () => {
  const initial = useMemo(loadInitialState, []);
  const [liveUser, setLiveUser] = useState<LiveUser | null>(initial.liveUser);
  const liveUserRef = useRef<LiveUser | null>(initial.liveUser);
  const sessionGenerationRef = useRef(initial.liveUser ? 1 : 0);
  const sessionEpochRef = useRef(initial.sessionEpoch);
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
    sessionEpochRef.current = snapshot.sessionEpoch;
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
    if (shared.sessionEpoch > sessionEpochRef.current) {
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
      if (!persistState({ token: tokenRef.current, liveUser: nextUser })) {
        return false;
      }
      userRevisionRef.current += 1;
      liveUserRef.current = nextUser;
      setLiveUser(nextUser);
      return true;
    },
    [persistState],
  );

  const commitLiveProfile = useCallback(
    async (
      expected: SessionIdentity,
      profile: CurrentProfile,
    ): Promise<boolean> => {
      const currentAtStart = liveUserRef.current;
      if (
        !currentAtStart ||
        currentAtStart.id !== expected.userId ||
        profile.id !== expected.userId ||
        sessionGenerationRef.current !== expected.generation
      ) {
        return false;
      }
      if (profile.role !== currentAtStart.role || profile.status !== 'active') {
        clearSession();
        return false;
      }

      const sequenceKey = `${expected.generation}:${expected.userId}`;
      const commitSequence =
        (profileCommitSequenceRef.current.get(sequenceKey) ?? 0) + 1;
      profileCommitSequenceRef.current.set(sequenceKey, commitSequence);
      const queryKey = ['identity', expected.userId, 'profile'] as const;
      await queryClient.cancelQueries({ queryKey, exact: true });

      const current = liveUserRef.current;
      if (
        commitSequence !== profileCommitSequenceRef.current.get(sequenceKey) ||
        !current ||
        current.id !== expected.userId ||
        profile.id !== expected.userId ||
        sessionGenerationRef.current !== expected.generation
      ) {
        return false;
      }

      const nextUser = {
        ...current,
        name: profile.fullName,
        email: profile.email,
        role: profile.role,
      };
      const identityChanged =
        nextUser.name !== current.name ||
        nextUser.email !== current.email ||
        nextUser.role !== current.role;
      if (!persistState({ token: tokenRef.current, liveUser: nextUser })) {
        return false;
      }
      queryClient.setQueryData(queryKey, profile);
      if (identityChanged) {
        userRevisionRef.current += 1;
        liveUserRef.current = nextUser;
        setLiveUser(nextUser);
      }
      return true;
    },
    [clearSession, persistState],
  );

  useEffect(
    () => subscribeToSharedAuth(sessionEpochRef.current, consumeSharedSession),
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
