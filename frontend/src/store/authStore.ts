/**
 * Location: src/store/authStore.ts
 * Purpose: Offer a thin abstraction around the auth context for future state store migration.
 * Why: Prepares the codebase for Zustand/RTK adoption without breaking existing hooks.
 */

import { useAuth } from '../lib/auth';

export function useAuthStore() {
  const {
    currentUser,
    updateCurrentUser,
    isAuthenticated,
    isRestoringSession,
    login,
    register,
    loginWithGoogle,
    completeGoogleLogin,
    restoreLiveSession,
    logout,
  } = useAuth();

  return {
    currentUser,
    updateCurrentUser,
    isAuthenticated,
    isRestoringSession,
    login,
    register,
    loginWithGoogle,
    completeGoogleLogin,
    restoreLiveSession,
    logout,
  };
}
