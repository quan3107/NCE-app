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
  LiveUser,
  PersistSnapshot,
  SessionIdentity,
} from './auth-types';

const synchronizeProfileCache = (user: LiveUser): void => {
  queryClient.setQueriesData(
    {
      queryKey: ['identity', user.id, 'profile'],
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
  const tokenRef = useRef<string | null>(initial.token);
  const refreshPromiseRef = useRef<Promise<string | null> | null>(null);
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
    tokenRef.current = null;
    liveUserRef.current = null;
    setLiveUser(null);
    queryClient.removeQueries({ queryKey: ['identity'] });
    persistState({
      token: null,
      liveUser: null,
    });
  }, [persistState]);

  const applyLiveSession = useCallback(
    (payload: AuthSuccessResponse) => {
      const nextUser = mapBackendUser(payload.user);
      const previousUser = liveUserRef.current;
      const replacesIdentity = previousUser?.id !== nextUser.id;

      if (replacesIdentity) {
        if (previousUser) {
          queryClient.removeQueries({ queryKey: ['identity'] });
        }
        sessionGenerationRef.current += 1;
      } else {
        synchronizeProfileCache(nextUser);
      }
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

  return {
    liveUser,
    sessionGeneration: sessionGenerationRef.current,
    tokenRef,
    refreshPromiseRef,
    shouldRefreshOnMountRef,
    applyLiveSession,
    updateLiveUser,
    clearSession,
  };
};
