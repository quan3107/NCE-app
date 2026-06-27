/**
 * Location: src/lib/auth-session.ts
 * Purpose: Own auth session state, persistence, and live-session application.
 * Why: Keeps AuthProvider focused on user-facing auth actions and context values.
 */

import { useCallback, useMemo, useRef, useState } from 'react';

import { STORAGE_KEYS } from './constants';
import {
  loadInitialState,
  mapBackendUser,
} from './auth-state';
import type {
  AuthSuccessResponse,
  LiveUser,
  PersistSnapshot,
} from './auth-types';

export const useAuthSession = () => {
  const initial = useMemo(loadInitialState, []);
  const [liveUser, setLiveUser] = useState<LiveUser | null>(initial.liveUser);
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
    tokenRef.current = null;
    setLiveUser(null);
    persistState({
      token: null,
      liveUser: null,
    });
  }, [persistState]);

  const applyLiveSession = useCallback(
    (payload: AuthSuccessResponse) => {
      const nextUser = mapBackendUser(payload.user);
      tokenRef.current = payload.accessToken;
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

  return {
    liveUser,
    tokenRef,
    refreshPromiseRef,
    shouldRefreshOnMountRef,
    applyLiveSession,
    clearSession,
  };
};
