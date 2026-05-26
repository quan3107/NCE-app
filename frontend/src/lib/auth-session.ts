/**
 * Location: src/lib/auth-session.ts
 * Purpose: Own auth session state, persistence, and live-session application.
 * Why: Keeps AuthProvider focused on user-facing auth actions and context values.
 */

import { useCallback, useMemo, useRef, useState } from 'react';

import { STORAGE_KEYS } from './constants';
import { DEFAULT_PERSONA } from './devPersonas';
import {
  DEFAULT_TOKEN,
  loadInitialState,
  mapBackendUser,
} from './auth-state';
import type {
  AuthMode,
  AuthSuccessResponse,
  LiveUser,
  PersistSnapshot,
  PersonaState,
} from './auth-types';

export const useAuthSession = () => {
  const initial = useMemo(loadInitialState, []);
  const [authMode, setAuthMode] = useState<AuthMode>(initial.mode);
  const [personaState, setPersonaState] = useState<PersonaState>(initial.persona);
  const [liveUser, setLiveUser] = useState<LiveUser | null>(initial.liveUser);
  const tokenRef = useRef<string | null>(initial.token);
  const refreshPromiseRef = useRef<Promise<string | null> | null>(null);
  const shouldRefreshOnMountRef = useRef(
    initial.mode === 'live' && Boolean(initial.token || initial.liveUser),
  );

  const buildSnapshot = useCallback(
    (overrides?: Partial<PersistSnapshot>): PersistSnapshot => ({
      mode: overrides?.mode ?? authMode,
      token: overrides?.token ?? tokenRef.current,
      persona: overrides?.persona ?? personaState,
      liveUser: overrides?.liveUser ?? liveUser,
    }),
    [authMode, personaState, liveUser],
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

  const setPersona = useCallback(
    (nextPersona: PersonaState, overrides?: Partial<PersistSnapshot>) => {
      setPersonaState(nextPersona);
      persistState(
        buildSnapshot({
          persona: nextPersona,
          ...overrides,
        }),
      );
    },
    [buildSnapshot, persistState],
  );

  const activatePersonaSession = useCallback(
    (basePersona: PersonaState['basePersona'], token: string | null = DEFAULT_TOKEN) => {
      const persona: PersonaState = { basePersona, actingPersona: null };
      tokenRef.current = token;
      setAuthMode('persona');
      setLiveUser(null);
      setPersona(persona, {
        mode: 'persona',
        token,
        liveUser: null,
      });
    },
    [setPersona],
  );

  const clearSession = useCallback(
    (nextMode: AuthMode) => {
      const persona: PersonaState = { basePersona: DEFAULT_PERSONA, actingPersona: null };
      tokenRef.current = null;
      setAuthMode(nextMode);
      setLiveUser(null);
      setPersona(persona, {
        mode: nextMode,
        token: null,
        liveUser: null,
      });
    },
    [setPersona],
  );

  const applyLiveSession = useCallback(
    (payload: AuthSuccessResponse) => {
      const nextUser = mapBackendUser(payload.user);
      tokenRef.current = payload.accessToken;
      setAuthMode('live');
      setLiveUser(nextUser);
      persistState(
        buildSnapshot({
          mode: 'live',
          token: payload.accessToken,
          liveUser: nextUser,
        }),
      );
      return nextUser;
    },
    [buildSnapshot, persistState],
  );

  const mutatePersonaState = useCallback(
    (updater: (previous: PersonaState) => PersonaState) => {
      setPersonaState((previous) => {
        const next = updater(previous);
        persistState(
          buildSnapshot({
            persona: next,
          }),
        );
        return next;
      });
    },
    [buildSnapshot, persistState],
  );

  return {
    authMode,
    setAuthMode,
    personaState,
    liveUser,
    tokenRef,
    refreshPromiseRef,
    shouldRefreshOnMountRef,
    activatePersonaSession,
    applyLiveSession,
    clearSession,
    mutatePersonaState,
  };
};
