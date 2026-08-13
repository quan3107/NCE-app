/**
 * Location: src/store/authStore.ts
 * Purpose: Offer a thin abstraction around the auth context for future state store migration.
 * Why: Prepares the codebase for Zustand/RTK adoption without breaking existing hooks.
 */

import { useAuth } from '../lib/auth';

export function useAuthStore() {
  const {
    currentUser,
    sessionGeneration,
    isAuthenticated,
    isRestoringSession,
    login,
    register,
    loginWithGoogle,
    cancelGoogleLogin,
    completeGoogleLogin,
    restoreLiveSession,
    logout,
  } = useAuth();

  return {
    currentUser,
    sessionGeneration,
    isAuthenticated,
    isRestoringSession,
    login,
    register,
    loginWithGoogle,
    cancelGoogleLogin,
    completeGoogleLogin,
    restoreLiveSession,
    logout,
  };
}
