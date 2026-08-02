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

async function revokeRejectedCookieSession(signal: AbortSignal): Promise<void> {
  await apiClient('/auth/logout', {
    method: 'POST',
    withAuth: false,
    credentials: 'include',
    parseJson: false,
    signal,
  });
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
    completeOAuthSession,
    isRestoringSession,
    restoreLiveSession,
    getAdmissionSessionVersion,
  } = useAuthRuntime();

  const login = useCallback(
    async (email: string, password: string) => {
      cookieOperations.cancelRefreshes();
      try {
        const committed = await cookieOperations.run(async (signal) => {
          // The operation admitted last owns the final cookie and UI intent.
          const admissionVersion = getAdmissionSessionVersion();
          const result = await apiClient<AuthSuccessResponse>('/auth/login', {
            method: 'POST',
            withAuth: false,
            credentials: 'include',
            body: { email, password },
            signal,
          });
          if (signal.aborted) {
            throw new ApiError('Login request timed out.', 0);
          }
          const applied = applyLiveSession(result, admissionVersion);
          if (!applied) await revokeRejectedCookieSession(signal);
          return applied;
        });
        return committed ? 'live' : null;
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
    [applyLiveSession, cookieOperations, getAdmissionSessionVersion],
  );

  const register = useCallback(
    async (payload: RegisterPayload): Promise<RegisterResult> => {
      cookieOperations.cancelRefreshes();
      return cookieOperations.run(async (signal) => {
        // Queued registration follows the same last-admitted cookie intent.
        const admissionVersion = getAdmissionSessionVersion();
        const result = await apiClient<
          AuthSuccessResponse | AuthPendingApprovalResponse
        >('/auth/register', {
          method: 'POST',
          withAuth: false,
          credentials: 'include',
          signal,
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
        if (signal.aborted) {
          throw new ApiError('Registration request timed out.', 0);
        }
        if (!applyLiveSession(result, admissionVersion)) {
          await revokeRejectedCookieSession(signal);
          throw new ApiError(
            'Registration was cancelled by a newer session change.',
            0,
          );
        }
        return 'live';
      });
    },
    [applyLiveSession, cookieOperations, getAdmissionSessionVersion],
  );

  const loginWithGoogle = useCallback(async () => {
    if (typeof window === 'undefined') {
      throw new ApiError('Google sign-in is only available in the browser.', 500);
    }

    try {
      cookieOperations.cancelRefreshes();
      const result = await cookieOperations.runOAuthStart(async (signal) => {
        const returnTo = `${window.location.origin}/auth/oauth`;
        return apiClient<{ authorizationUrl: string }>('/auth/google', {
          withAuth: false,
          credentials: 'include',
          params: {
            returnTo,
          },
          signal,
        });
      });
      window.location.href = result.authorizationUrl;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError('Unable to start Google sign-in. Please try again.', 500);
    }
  }, [cookieOperations]);

  const completeGoogleLogin = useCallback(async (): Promise<'live'> => {
    const result = await completeOAuthSession();
    if (result.status !== 'refreshed') {
      throw new ApiError('Unable to finalize Google sign-in. Please try again.', 401);
    }
    return 'live';
  }, [completeOAuthSession]);

  const cancelGoogleLogin = useCallback(() => {
    cookieOperations.cancelOAuthCompletions();
    void cookieOperations.releaseOAuthLease().catch(() => undefined);
  }, [cookieOperations]);

  const logout = useCallback(async () => {
    cookieOperations.cancelRefreshes();
    clearSession();
    await cookieOperations.run(async (signal) => {
      // An earlier queued login may have restored identity after the immediate clear.
      clearSession();
      await apiClient('/auth/logout', {
        method: 'POST',
        withAuth: false,
        credentials: 'include',
        parseJson: false,
        signal,
      });
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
      cancelGoogleLogin,
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
      cancelGoogleLogin,
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
