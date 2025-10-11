/**
 * Location: src/lib/auth.tsx
 * Purpose: Provide a persona-driven auth context that supports admin impersonation flows.
 * Why: Keeps temporary login aligned with backend guards while allowing admins to preview other roles.
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

import type { Role, User } from './mock-data';
import {
  DEFAULT_PERSONA,
  PERSONA_HEADERS,
  PERSONA_USERS,
  PersonaKey,
  isPersonaKey,
  roleToPersonaKey,
} from './devPersonas';
import { STORAGE_KEYS } from './constants';

type PersonaState = {
  basePersona: PersonaKey;
  actingPersona: PersonaKey | null;
};

type StoredAuthPayload = {
  basePersona?: PersonaKey;
  actingPersona?: PersonaKey | null;
  token?: string;
  effective?: {
    id?: string;
    role?: Role;
  };
  // Legacy fields
  id?: string;
  role?: Role;
};

type AuthContextType = {
  currentUser: User;
  isAuthenticated: boolean;
  actingRole: Role | null;
  isImpersonating: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  loginWithGoogle: () => Promise<boolean>;
  logout: () => void;
  switchRole: (role: Role) => void;
  viewAs: (role: Role) => void;
  stopImpersonating: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEFAULT_TOKEN = 'dev-admin-token';

const loadInitialState = (): { state: PersonaState; token: string | null } => {
  if (typeof window === 'undefined') {
    return {
      state: { basePersona: DEFAULT_PERSONA, actingPersona: null },
      token: DEFAULT_TOKEN,
    };
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEYS.currentUser);
    if (!stored) {
      return {
        state: { basePersona: DEFAULT_PERSONA, actingPersona: null },
        token: DEFAULT_TOKEN,
      };
    }

    const parsed = JSON.parse(stored) as StoredAuthPayload;
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Invalid stored auth payload');
    }

    if (parsed.basePersona) {
      const base = isPersonaKey(parsed.basePersona)
        ? parsed.basePersona
        : DEFAULT_PERSONA;
      const acting = isPersonaKey(parsed.actingPersona)
        ? parsed.actingPersona
        : null;
      const token =
        typeof parsed.token === 'string' && parsed.token.length > 0
          ? parsed.token
          : DEFAULT_TOKEN;
      return {
        state: { basePersona: base, actingPersona: acting },
        token,
      };
    }

    if (parsed.role) {
      const persona =
        roleToPersonaKey[parsed.role] ?? (parsed.role === 'public' ? null : DEFAULT_PERSONA);
      return {
        state: {
          basePersona: persona ?? DEFAULT_PERSONA,
          actingPersona: null,
        },
        token:
          typeof parsed.token === 'string' && parsed.token.length > 0
            ? parsed.token
            : DEFAULT_TOKEN,
      };
    }
  } catch {
    // Ignore parse errors and fall back to defaults.
  }

  return {
    state: { basePersona: DEFAULT_PERSONA, actingPersona: null },
    token: DEFAULT_TOKEN,
  };
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const initial = useMemo(loadInitialState, []);
  const [personaState, setPersonaState] = useState<PersonaState>(initial.state);
  const tokenRef = useRef<string | null>(initial.token);

  const persistState = useCallback(
    (state: PersonaState) => {
      if (typeof window === 'undefined') {
        return;
      }
      const effectivePersona = state.actingPersona ?? state.basePersona;
      const payload: StoredAuthPayload = {
        basePersona: state.basePersona,
        actingPersona: state.actingPersona,
        token: tokenRef.current ?? undefined,
        effective: PERSONA_HEADERS[effectivePersona],
      };
      localStorage.setItem(STORAGE_KEYS.currentUser, JSON.stringify(payload));
    },
    [tokenRef],
  );

  const updatePersonaState = useCallback(
    (updater: (previous: PersonaState) => PersonaState) => {
      setPersonaState((previous) => {
        const next = updater(previous);
        persistState(next);
        return next;
      });
    },
    [persistState],
  );

  useEffect(() => {
    persistState(personaState);
  }, [personaState, persistState]);

  const effectivePersona = personaState.actingPersona ?? personaState.basePersona;
  const currentUser = PERSONA_USERS[effectivePersona];
  const actingRole =
    personaState.actingPersona !== null
      ? PERSONA_USERS[personaState.actingPersona].role
      : null;
  const isImpersonating = personaState.actingPersona !== null;
  const isAuthenticated = tokenRef.current !== null;

  const login = useCallback(async (_email: string, _password: string) => {
    tokenRef.current = DEFAULT_TOKEN;
    updatePersonaState(() => ({
      basePersona: 'admin',
      actingPersona: null,
    }));
    return true;
  }, [updatePersonaState]);

  const loginWithGoogle = useCallback(async () => {
    tokenRef.current = 'dev-student-token';
    updatePersonaState(() => ({
      basePersona: 'student',
      actingPersona: null,
    }));
    return true;
  }, [updatePersonaState]);

  const logout = useCallback(() => {
    tokenRef.current = null;
    updatePersonaState(() => ({
      basePersona: DEFAULT_PERSONA,
      actingPersona: null,
    }));
  }, [updatePersonaState]);

  const stopImpersonating = useCallback(() => {
    updatePersonaState((previous) => ({
      basePersona: previous.basePersona,
      actingPersona: null,
    }));
  }, [updatePersonaState]);

  const viewAs = useCallback(
    (role: Role) => {
      updatePersonaState((previous) => {
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
    [updatePersonaState],
  );

  const switchRole = useCallback(
    (role: Role) => {
      viewAs(role);
    },
    [viewAs],
  );

  const contextValue = useMemo<AuthContextType>(
    () => ({
      currentUser,
      isAuthenticated,
      actingRole,
      isImpersonating,
      login,
      loginWithGoogle,
      logout,
      switchRole,
      viewAs,
      stopImpersonating,
    }),
    [
      actingRole,
      currentUser,
      isAuthenticated,
      isImpersonating,
      login,
      loginWithGoogle,
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
