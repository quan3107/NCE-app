/**
 * Location: src/lib/auth.tsx
 * Purpose: Manage live backend authentication sessions.
 * Why: Keeps auth state, restore, and sign-in flows tied to the server session source.
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
import { PUBLIC_USER } from './auth-state';
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
    liveUser,
    tokenRef,
    refreshPromiseRef,
    shouldRefreshOnMountRef,
    applyLiveSession,
    clearSession,
  } = useAuthSession();
  const [isRestoringSession, setIsRestoringSession] = useState(
    shouldRefreshOnMountRef.current,
  );

  const refreshAccessToken = useCallback(async (): Promise<string | null> => {
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
          clearSession();
        }
        return null;
      } finally {
        refreshPromiseRef.current = null;
      }
    })();

    refreshPromiseRef.current = refreshPromise;
    return refreshPromise;
  }, [applyLiveSession, clearSession]);

  const restoreLiveSession = useCallback(async (): Promise<boolean> => {
    setIsRestoringSession(true);
    try {
      const token = await refreshAccessToken();
      return Boolean(token);
    } finally {
      setIsRestoringSession(false);
    }
  }, [refreshAccessToken]);

  useEffect(() => {
    authBridge.configure({
      getAccessToken: () => tokenRef.current,
      refreshAccessToken,
      clearSession,
    });
    return () => {
      authBridge.reset();
    };
  }, [clearSession, refreshAccessToken]);

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
        if (error instanceof ApiError && error.status === 400) {
          // Bubble validation errors so the login UI can show field feedback.
          throw error;
        }
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
          return null;
        }
        throw error;
      }
    },
    [applyLiveSession],
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
    clearSession();
  }, [clearSession]);

  const currentUser = liveUser ?? PUBLIC_USER;
  const isAuthenticated = Boolean(tokenRef.current && liveUser);

  const contextValue = useMemo<AuthContextType>(
    () => ({
      currentUser,
      isAuthenticated,
      isRestoringSession,
      login,
      register,
      loginWithGoogle,
      completeGoogleLogin,
      restoreLiveSession,
      logout,
    }),
    [
      currentUser,
      isAuthenticated,
      isRestoringSession,
      login,
      register,
      loginWithGoogle,
      completeGoogleLogin,
      restoreLiveSession,
      logout,
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
