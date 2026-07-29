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
  useMemo,
} from 'react';

import { ApiError, apiClient } from './apiClient';
import { PUBLIC_USER } from './auth-state';
import { useAuthRuntime } from './use-auth-runtime';
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
    sessionGeneration,
    tokenRef,
    applyLiveSession,
    updateLiveUser,
    commitLiveProfile,
    clearSession,
    cookieOperations,
    isRestoringSession,
    refreshAccessToken,
    restoreLiveSession,
  } = useAuthRuntime();

  const login = useCallback(
    async (email: string, password: string) => {
      cookieOperations.cancelRefreshes();
      try {
        await cookieOperations.run(async () => {
          const result = await apiClient<AuthSuccessResponse>('/auth/login', {
            method: 'POST',
            withAuth: false,
            credentials: 'include',
            body: { email, password },
          });
          applyLiveSession(result);
        });
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
    [applyLiveSession, cookieOperations],
  );

  const register = useCallback(
    async (payload: RegisterPayload): Promise<RegisterResult> => {
      cookieOperations.cancelRefreshes();
      return cookieOperations.run(async () => {
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
      });
    },
    [applyLiveSession, cookieOperations],
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
    const result = await refreshAccessToken();
    if (result.status !== 'refreshed') {
      throw new ApiError('Unable to finalize Google sign-in. Please try again.', 401);
    }
    return 'live';
  }, [refreshAccessToken]);

  const logout = useCallback(async () => {
    cookieOperations.cancelRefreshes();
    clearSession();
    await cookieOperations.run(async () => {
      // An earlier queued login may have restored identity after the immediate clear.
      clearSession();
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
    });
  }, [clearSession, cookieOperations]);

  const currentUser = liveUser ?? PUBLIC_USER;
  const isAuthenticated = Boolean(tokenRef.current && liveUser);

  const contextValue = useMemo<AuthContextType>(
    () => ({
      currentUser,
      sessionGeneration,
      updateCurrentUser: updateLiveUser,
      commitCurrentProfile: commitLiveProfile,
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
      sessionGeneration,
      updateLiveUser,
      commitLiveProfile,
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
