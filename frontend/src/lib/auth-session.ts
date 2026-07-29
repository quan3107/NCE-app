/**
 * Location: src/lib/auth-session.ts
 * Purpose: Own auth session state, persistence, and live-session application.
 * Why: Keeps AuthProvider focused on user-facing auth actions and context values.
 */

import { useCallback, useMemo, useRef, useState } from 'react';

import { STORAGE_KEYS } from './constants';
import { queryClient } from './queryClient';
import {
  loadInitialState,
  mapBackendUser,
} from './auth-state';
import type {
  AuthSuccessResponse,
  CurrentProfile,
  LiveUser,
  PersistSnapshot,
  RefreshAccessTokenResult,
  SessionIdentity,
} from './auth-types';

type SessionVersion = {
  generation: number;
  userRevision: number;
  userId: string | null;
};

type RefreshPromiseSlot = {
  generation: number;
  promise: Promise<RefreshAccessTokenResult>;
};

const synchronizeProfileCache = (user: LiveUser): void => {
  const queryKey = ['identity', user.id, 'profile'] as const;
  void queryClient.cancelQueries({ queryKey, exact: true });
  queryClient.setQueriesData(
    {
      queryKey,
      exact: true,
    },
    (cached: unknown) => {
      if (
        !cached ||
        typeof cached !== 'object' ||
        !('id' in cached) ||
        cached.id !== user.id
      ) {
        return cached;
      }

      return {
        ...cached,
        email: user.email,
        fullName: user.name,
        role: user.role,
      };
    },
  );
};

export const useAuthSession = () => {
  const initial = useMemo(loadInitialState, []);
  const [liveUser, setLiveUser] = useState<LiveUser | null>(initial.liveUser);
  const liveUserRef = useRef<LiveUser | null>(initial.liveUser);
  const sessionGenerationRef = useRef(initial.liveUser ? 1 : 0);
  const userRevisionRef = useRef(initial.liveUser ? 1 : 0);
  const profileCommitSequenceRef = useRef(new Map<string, number>());
  const tokenRef = useRef<string | null>(initial.token);
  const refreshPromiseRef = useRef<RefreshPromiseSlot | null>(null);
  const shouldRefreshOnMountRef = useRef(
    Boolean(initial.token || initial.liveUser),
  );

  const buildSnapshot = useCallback(
    (overrides?: Partial<PersistSnapshot>): PersistSnapshot => ({
      token: overrides?.token ?? tokenRef.current,
      liveUser: overrides?.liveUser ?? liveUser,
    }),
    [liveUser],
  );

  const persistState = useCallback(
    (snapshot: PersistSnapshot) => {
      if (typeof window === 'undefined') {
        return;
      }
      localStorage.setItem(STORAGE_KEYS.currentUser, JSON.stringify(snapshot));
    },
    [],
  );

  const clearSession = useCallback(() => {
    sessionGenerationRef.current += 1;
    userRevisionRef.current += 1;
    tokenRef.current = null;
    liveUserRef.current = null;
    refreshPromiseRef.current = null;
    profileCommitSequenceRef.current.clear();
    setLiveUser(null);
    queryClient.removeQueries({ queryKey: ['identity'] });
    persistState({
      token: null,
      liveUser: null,
    });
  }, [persistState]);

  const getSessionVersion = useCallback(
    (): SessionVersion => ({
      generation: sessionGenerationRef.current,
      userRevision: userRevisionRef.current,
      userId: liveUserRef.current?.id ?? null,
    }),
    [],
  );

  const applyLiveSession = useCallback(
    (payload: AuthSuccessResponse, expectedVersion?: SessionVersion) => {
      const nextUser = mapBackendUser(payload.user);
      const previousUser = liveUserRef.current;
      if (
        expectedVersion &&
        (expectedVersion.generation !== sessionGenerationRef.current ||
          expectedVersion.userId !== (previousUser?.id ?? null))
      ) {
        return previousUser;
      }

      const replacesIdentity = previousUser?.id !== nextUser.id;
      const userChangedSinceRequest =
        expectedVersion &&
        !replacesIdentity &&
        expectedVersion.userRevision !== userRevisionRef.current;

      if (userChangedSinceRequest) {
        tokenRef.current = payload.accessToken;
        persistState({
          token: payload.accessToken,
          liveUser: previousUser,
        });
        return previousUser;
      }

      if (replacesIdentity) {
        profileCommitSequenceRef.current.clear();
        if (previousUser) {
          queryClient.removeQueries({ queryKey: ['identity'] });
        }
        sessionGenerationRef.current += 1;
      } else {
        synchronizeProfileCache(nextUser);
      }
      userRevisionRef.current += 1;
      tokenRef.current = payload.accessToken;
      liveUserRef.current = nextUser;
      setLiveUser(nextUser);
      persistState(
        buildSnapshot({
          token: payload.accessToken,
          liveUser: nextUser,
        }),
      );
      return nextUser;
    },
    [buildSnapshot, persistState],
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
      userRevisionRef.current += 1;
      liveUserRef.current = nextUser;
      setLiveUser(nextUser);
      persistState({
        token: tokenRef.current,
        liveUser: nextUser,
      });
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

      queryClient.setQueryData(queryKey, profile);
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
      if (identityChanged) {
        userRevisionRef.current += 1;
        liveUserRef.current = nextUser;
        setLiveUser(nextUser);
        persistState({
          token: tokenRef.current,
          liveUser: nextUser,
        });
      }
      return true;
    },
    [persistState],
  );

  return {
    liveUser,
    sessionGeneration: sessionGenerationRef.current,
    tokenRef,
    refreshPromiseRef,
    shouldRefreshOnMountRef,
    getSessionVersion,
    applyLiveSession,
    updateLiveUser,
    commitLiveProfile,
    clearSession,
  };
};
