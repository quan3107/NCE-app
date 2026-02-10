/**
 * Location: src/lib/auth.tsx
 * Purpose: Manage dual-mode authentication, supporting live backend sessions with persona fallbacks.
 * Why: Enables a gradual transition from mock personas to real auth while keeping existing tooling working.
 */

import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { ApiError, apiClient } from './apiClient';
import { authBridge } from './authBridge';
import { ENABLE_DEV_AUTH_FALLBACK, STORAGE_KEYS } from './constants';
import {
  DEFAULT_PERSONA,
  PERSONA_USERS,
  PersonaKey,
  isPersonaKey,
  roleToPersonaKey,
} from './devPersonas';
import type { Role, User } from '@types/domain';

type AuthMode = 'live' | 'persona';
type SupportedRole = Exclude<Role, 'public'>;

type PersonaState = {
  basePersona: PersonaKey;
  actingPersona: PersonaKey | null;
};

type LiveUser = User;

type BackendAuthUser = {
  id: string;
  email: string;
  fullName: string;
  role: SupportedRole;
};

type AuthSuccessResponse = {
  user: BackendAuthUser;
  accessToken: string;
};

type RegisterRole = Extract<SupportedRole, 'admin' | 'student' | 'teacher'>;

export type RegisterPayload = {
  fullName: string;
  email: string;
  password: string;
  role: RegisterRole;
};

type StoredAuthPayload = {
  mode?: AuthMode;
  token?: string | null;
  persona?: PersonaState;
  liveUser?: LiveUser | null;
  // Legacy persona fields
  basePersona?: PersonaKey;
  actingPersona?: PersonaKey | null;
  effective?: {
    id?: string;
    role?: Role;
  };
  id?: string;
  role?: Role;
};

type AuthContextType = {
  authMode: AuthMode;
  currentUser: User;
  isAuthenticated: boolean;
  actingRole: Role | null;
  isImpersonating: boolean;
  login: (email: string, password: string) => Promise<AuthMode | null>;
  register: (payload: RegisterPayload) => Promise<'live'>;
  loginWithGoogle: () => Promise<void>;
  completeGoogleLogin: () => Promise<'live'>;
  logout: () => Promise<void>;
  switchRole: (role: Role) => void;
  viewAs: (role: Role) => void;
  stopImpersonating: () => void;
};

type PersistSnapshot = {
  mode: AuthMode;
  token: string | null;
  persona: PersonaState;
  liveUser: LiveUser | null;
};

type InitialSnapshot = PersistSnapshot;

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEFAULT_TOKEN = 'dev-admin-token';
const DEMO_PASSWORD = 'Passw0rd!';
// Public placeholder to keep UI rendering predictable when unauthenticated.
const PUBLIC_USER: LiveUser = {
  id: '',
  name: 'Guest',
  email: '',
  role: 'public',
};

const PERSONA_BY_EMAIL = Object.values(PERSONA_USERS).reduce<Record<string, PersonaKey>>(
  (accumulator, personaUser) => {
    accumulator[personaUser.email.toLowerCase()] = personaUser.persona;
    return accumulator;
  },
  {},
);

const mapBackendUser = (user: BackendAuthUser): LiveUser => ({
  id: user.id,
  email: user.email,
  name: user.fullName,
  role: user.role,
});

const loadInitialState = (): InitialSnapshot => {
  const defaultSnapshot: InitialSnapshot = ENABLE_DEV_AUTH_FALLBACK
    ? {
        mode: 'persona',
        token: DEFAULT_TOKEN,
        persona: { basePersona: DEFAULT_PERSONA, actingPersona: null },
        liveUser: null,
      }
    : {
        mode: 'live',
        token: null,
        persona: { basePersona: DEFAULT_PERSONA, actingPersona: null },
        liveUser: null,
      };

  if (typeof window === 'undefined') {
    return defaultSnapshot;
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEYS.currentUser);
    if (!stored) {
      return defaultSnapshot;
    }

    const parsed = JSON.parse(stored) as StoredAuthPayload;
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Invalid stored auth payload');
    }

    const storedMode: AuthMode = parsed.mode === 'live' ? 'live' : 'persona';
    const mode: AuthMode = ENABLE_DEV_AUTH_FALLBACK ? storedMode : 'live';
    const persona: PersonaState =
      parsed.persona ??
      {
        basePersona: isPersonaKey(parsed.basePersona) ? parsed.basePersona : DEFAULT_PERSONA,
        actingPersona: isPersonaKey(parsed.actingPersona) ? parsed.actingPersona : null,
      };

    const parsedToken =
      'token' in parsed
        ? typeof parsed.token === 'string' && parsed.token.length > 0
          ? parsed.token
          : null
        : null;
    const token =
      mode === 'live'
        ? parsedToken
        : ENABLE_DEV_AUTH_FALLBACK
          ? parsedToken ?? DEFAULT_TOKEN
          : null;

    const liveUser = mode === 'live' && parsed.liveUser ? parsed.liveUser : null;

    return {
      mode,
      token,
      persona,
      liveUser,
    };
  } catch {
    return defaultSnapshot;
  }
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const initial = useMemo(loadInitialState, []);
  const [authMode, setAuthMode] = useState<AuthMode>(initial.mode);
  const [personaState, setPersonaState] = useState<PersonaState>(initial.persona);
  const [liveUser, setLiveUser] = useState<LiveUser | null>(initial.liveUser);
  const tokenRef = useRef<string | null>(initial.token);
  const refreshPromiseRef = useRef<Promise<string | null> | null>(null);
  // Only attempt refresh on mount if we have evidence of a prior live session.
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
    (basePersona: PersonaKey, token: string | null = DEFAULT_TOKEN) => {
      if (!ENABLE_DEV_AUTH_FALLBACK) {
        return;
      }
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

  const clearSession = useCallback(() => {
    const persona: PersonaState = { basePersona: DEFAULT_PERSONA, actingPersona: null };
    tokenRef.current = null;
    const nextMode: AuthMode = ENABLE_DEV_AUTH_FALLBACK ? 'persona' : 'live';
    setAuthMode(nextMode);
    setLiveUser(null);
    setPersona(persona, {
      mode: nextMode,
      token: null,
      liveUser: null,
    });
  }, [setPersona]);

  const refreshAccessToken = useCallback(async (): Promise<string | null> => {
    if (authMode !== 'live') {
      return null;
    }

    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }

    const refreshPromise = (async () => {
      try {
        const result = await apiClient<AuthSuccessResponse>('/auth/refresh', {
          method: 'POST',
          withAuth: false,
          credentials: 'include',
        });
        applyLiveSession(result);
        return tokenRef.current;
      } catch {
        clearSession();
        return null;
      } finally {
        refreshPromiseRef.current = null;
      }
    })();

    refreshPromiseRef.current = refreshPromise;
    return refreshPromise;
  }, [applyLiveSession, authMode, clearSession]);

  useEffect(() => {
    authBridge.configure({
      getAccessToken: () => (authMode === 'live' ? tokenRef.current : null),
      refreshAccessToken,
      clearSession,
    });
    return () => {
      authBridge.reset();
    };
  }, [authMode, clearSession, refreshAccessToken]);

  useEffect(() => {
    if (!shouldRefreshOnMountRef.current) {
      return;
    }
    shouldRefreshOnMountRef.current = false;
    void refreshAccessToken();
  }, [refreshAccessToken]);

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

  const login = useCallback(
    async (email: string, password: string) => {
      try {
        const result = await apiClient<AuthSuccessResponse>('/auth/login', {
          method: 'POST',
          withAuth: false,
          credentials: 'include',
          body: { email, password },
        });
        applyLiveSession(result);
        return 'live';
      } catch (error) {
        if (!ENABLE_DEV_AUTH_FALLBACK) {
          if (error instanceof ApiError && error.status === 400) {
            // Bubble validation errors so the login UI can show field feedback.
            throw error;
          }
          if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
            return null;
          }
          return null;
        }
        const normalizedEmail = email.trim().toLowerCase();
        const personaKey = PERSONA_BY_EMAIL[normalizedEmail];

        if (personaKey && password === DEMO_PASSWORD) {
          activatePersonaSession(personaKey);
          return 'persona';
        }

        if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
          return null;
        }

        if (personaKey) {
          activatePersonaSession(personaKey);
          return 'persona';
        }

        return null;
      }
    },
    [activatePersonaSession, applyLiveSession],
  );

  const register = useCallback(
    async (payload: RegisterPayload): Promise<'live'> => {
      const result = await apiClient<AuthSuccessResponse>('/auth/register', {
        method: 'POST',
        withAuth: false,
        credentials: 'include',
        body: {
          fullName: payload.fullName.trim(),
          email: payload.email.trim(),
          password: payload.password,
          role: payload.role,
        },
      });
      applyLiveSession(result);
      return 'live';
    },
    [applyLiveSession],
  );

  const loginWithGoogle = useCallback(async () => {
    if (typeof window === 'undefined') {
      throw new ApiError('Google sign-in is only available in the browser.', 500);
    }

    try {
      const returnTo = `${window.location.origin}/auth/oauth`;
      const result = await apiClient<{ authorizationUrl: string }>('/auth/google', {
        withAuth: false,
        credentials: 'include',
        params: {
          returnTo,
        },
      });
      window.location.href = result.authorizationUrl;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError('Unable to start Google sign-in. Please try again.', 500);
    }
  }, []);

  const completeGoogleLogin = useCallback(async (): Promise<'live'> => {
    const token = await refreshAccessToken();
    if (!token) {
      throw new ApiError('Unable to finalize Google sign-in. Please try again.', 401);
    }
    return 'live';
  }, [refreshAccessToken]);

  const logout = useCallback(async () => {
    if (authMode === 'live') {
      try {
        await apiClient('/auth/logout', {
          method: 'POST',
          withAuth: false,
          credentials: 'include',
          parseJson: false,
        });
      } catch {
        // Ignore logout errors; we still clear the local session.
      }
    }
    clearSession();
  }, [authMode, clearSession]);

  const stopImpersonating = useCallback(() => {
    if (!ENABLE_DEV_AUTH_FALLBACK) {
      return;
    }
    mutatePersonaState((previous) => ({
      basePersona: previous.basePersona,
      actingPersona: null,
    }));
  }, [mutatePersonaState]);

  const viewAs = useCallback(
    (role: Role) => {
      if (!ENABLE_DEV_AUTH_FALLBACK) {
        return;
      }
      if (authMode !== 'persona') {
        return;
      }
      mutatePersonaState((previous) => {
        if (previous.basePersona !== 'admin') {
          return previous;
        }
        const targetPersona = roleToPersonaKey[role];
        if (!targetPersona || targetPersona === 'admin') {
          return {
            basePersona: previous.basePersona,
            actingPersona: null,
          };
        }
        return {
          basePersona: previous.basePersona,
          actingPersona: targetPersona,
        };
      });
    },
    [authMode, mutatePersonaState],
  );

  const switchRole = useCallback(
    (role: Role) => {
      viewAs(role);
    },
    [viewAs],
  );

  const effectivePersona =
    personaState.actingPersona !== null ? personaState.actingPersona : personaState.basePersona;

  const personaUser = PERSONA_USERS[effectivePersona];
  const fallbackUser = ENABLE_DEV_AUTH_FALLBACK ? personaUser : PUBLIC_USER;
  const currentUser = authMode === 'live' && liveUser ? liveUser : fallbackUser;

  const actingRole =
    ENABLE_DEV_AUTH_FALLBACK && authMode === 'persona' && personaState.actingPersona
      ? PERSONA_USERS[personaState.actingPersona].role
      : null;

  const isImpersonating =
    ENABLE_DEV_AUTH_FALLBACK && authMode === 'persona' && personaState.actingPersona !== null;
  const hasLiveToken = authMode === 'live' && Boolean(tokenRef.current);
  const hasPersonaToken =
    ENABLE_DEV_AUTH_FALLBACK && authMode === 'persona' && Boolean(tokenRef.current);
  const isAuthenticated = hasLiveToken || hasPersonaToken;

  const contextValue = useMemo<AuthContextType>(
    () => ({
      authMode,
      currentUser,
      isAuthenticated,
      actingRole,
      isImpersonating,
      login,
      register,
      loginWithGoogle,
      completeGoogleLogin,
      logout,
      switchRole,
      viewAs,
      stopImpersonating,
    }),
    [
      actingRole,
      authMode,
      currentUser,
      isAuthenticated,
      isImpersonating,
      login,
      register,
      loginWithGoogle,
      completeGoogleLogin,
      logout,
      stopImpersonating,
      switchRole,
      viewAs,
    ],
  );

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
