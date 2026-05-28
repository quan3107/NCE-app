/**
 * Location: src/lib/auth-restore.ts
 * Purpose: Centralize protected-route live session restoration decisions.
 * Why: Makes reload/deep-link auth guard behavior easy to test without a browser.
 */

import type { Role } from '@domain';
import type { AuthMode } from './auth-types';

export type ProtectedRouteAuthDecision = 'allow' | 'loading' | 'redirect' | 'restore';

type ProtectedRouteAuthDecisionInput = {
  authMode: AuthMode;
  currentUserRole: Role;
  isAuthenticated: boolean;
  isRestoringSession: boolean;
  requiresAuth: boolean;
  restoreAttempted: boolean;
};

type ReturnToLocation = {
  pathname: string;
  search: string;
  hash: string;
};

export function buildAuthReturnTo(location: ReturnToLocation) {
  return `${location.pathname}${location.search}${location.hash}`;
}

export function resolveProtectedRouteAuthDecision({
  authMode,
  currentUserRole,
  isAuthenticated,
  isRestoringSession,
  requiresAuth,
  restoreAttempted,
}: ProtectedRouteAuthDecisionInput): ProtectedRouteAuthDecision {
  if (!requiresAuth) {
    return 'allow';
  }

  if (isAuthenticated && currentUserRole !== 'public') {
    return 'allow';
  }

  if (authMode !== 'live') {
    return 'redirect';
  }

  if (isRestoringSession) {
    return 'loading';
  }

  return restoreAttempted ? 'redirect' : 'restore';
}
