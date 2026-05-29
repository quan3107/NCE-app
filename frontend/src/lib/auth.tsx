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
  useState,
} from 'react';

import { ApiError, apiClient } from './apiClient';
import { authBridge } from './authBridge';
import { shouldClearSessionAfterRefreshFailure } from './auth-refresh';
import { ENABLE_DEV_AUTH_FALLBACK } from './constants';
import {
  PERSONA_USERS,
  roleToPersonaKey,
} from './devPersonas';
import type { Role } from '@domain';
import {
  DEMO_PASSWORD,
  PERSONA_BY_EMAIL,
  PUBLIC_USER,
} from './auth-state';
import { useAuthSession } from './auth-session';
import type {
  AuthContextType,
  AuthPendingApprovalResponse,
  AuthSuccessResponse,
  RegisterPayload,
  RegisterResult,
} from './auth-types';

export type { RegisterPayload } from './auth-types';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function isPendingApprovalResponse(
  response: AuthSuccessResponse | AuthPendingApprovalResponse,
): response is AuthPendingApprovalResponse {
  return 'status' in response && response.status === 'pending_approval';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const {
    authMode,
    personaState,
    liveUser,
    tokenRef,
    refreshPromiseRef,
    shouldRefreshOnMountRef,
    activatePersonaSession,
    applyLiveSession,
    clearSession,
    mutatePersonaState,
  } = useAuthSession();
  const [isRestoringSession, setIsRestoringSession] = useState(
    shouldRefreshOnMountRef.current,
  );

  const refreshAccessToken = useCallback(async (): Promise<string | null> => {
    if (authMode !== 'live') {
      return null;
    }

    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }

    const tokenAtRefreshStart = tokenRef.current;
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
        if (shouldClearSessionAfterRefreshFailure(tokenAtRefreshStart, tokenRef.current)) {
          clearSession(ENABLE_DEV_AUTH_FALLBACK ? 'persona' : 'live');
        }
        return null;
      } finally {
        refreshPromiseRef.current = null;
      }
    })();

    refreshPromiseRef.current = refreshPromise;
    return refreshPromise;
  }, [applyLiveSession, authMode, clearSession]);

  const restoreLiveSession = useCallback(async (): Promise<boolean> => {
    if (authMode !== 'live') {
      return false;
    }

    setIsRestoringSession(true);
    try {
      const token = await refreshAccessToken();
      return Boolean(token);
    } finally {
      setIsRestoringSession(false);
    }
  }, [authMode, refreshAccessToken]);

  useEffect(() => {
    authBridge.configure({
      getAccessToken: () => (authMode === 'live' ? tokenRef.current : null),
      refreshAccessToken,
      clearSession: () => clearSession(ENABLE_DEV_AUTH_FALLBACK ? 'persona' : 'live'),
    });
    return () => {
      authBridge.reset();
    };
  }, [authMode, clearSession, refreshAccessToken]);

  useEffect(() => {
    if (!shouldRefreshOnMountRef.current) {
      setIsRestoringSession(false);
      return;
    }
    shouldRefreshOnMountRef.current = false;
    void restoreLiveSession();
  }, [restoreLiveSession, shouldRefreshOnMountRef]);

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
    async (payload: RegisterPayload): Promise<RegisterResult> => {
      const result = await apiClient<
        AuthSuccessResponse | AuthPendingApprovalResponse
      >('/auth/register', {
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
      if (isPendingApprovalResponse(result)) {
        return 'pending_approval';
      }
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
    clearSession(ENABLE_DEV_AUTH_FALLBACK ? 'persona' : 'live');
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
      isRestoringSession,
      actingRole,
      isImpersonating,
      login,
      register,
      loginWithGoogle,
      completeGoogleLogin,
      restoreLiveSession,
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
      isRestoringSession,
      isImpersonating,
      login,
      register,
      loginWithGoogle,
      completeGoogleLogin,
      restoreLiveSession,
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
