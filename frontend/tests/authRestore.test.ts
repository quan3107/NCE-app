/**
 * Location: tests/authRestore.test.ts
 * Purpose: Verify protected-route auth restore decisions.
 * Why: Keeps reload/deep-link restoration behavior independent from React mounting.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  buildAuthReturnTo,
  resolveProtectedRouteAuthDecision,
} from '../src/lib/auth-restore';

test('protected live route without an authenticated role restores before redirecting', () => {
  const decision = resolveProtectedRouteAuthDecision({
    currentUserRole: 'public',
    isAuthenticated: false,
    isRestoringSession: false,
    requiresAuth: true,
    restoreAttempted: false,
  });

  assert.equal(decision, 'restore');
});

test('protected live route renders loading while restore is in progress', () => {
  const decision = resolveProtectedRouteAuthDecision({
    currentUserRole: 'public',
    isAuthenticated: false,
    isRestoringSession: true,
    requiresAuth: true,
    restoreAttempted: false,
  });

  assert.equal(decision, 'loading');
});

test('restore failure redirects to login with the original path preserved', () => {
  const decision = resolveProtectedRouteAuthDecision({
    currentUserRole: 'public',
    isAuthenticated: false,
    isRestoringSession: false,
    requiresAuth: true,
    restoreAttempted: true,
  });
  const returnTo = buildAuthReturnTo({
    hash: '#feedback',
    pathname: '/teacher/assignments/assignment-1/edit',
    search: '?tab=rubric',
  });

  assert.equal(decision, 'redirect');
  assert.equal(returnTo, '/teacher/assignments/assignment-1/edit?tab=rubric#feedback');
});

test('public routes do not trigger live-session restore', () => {
  const decision = resolveProtectedRouteAuthDecision({
    currentUserRole: 'public',
    isAuthenticated: false,
    isRestoringSession: false,
    requiresAuth: false,
    restoreAttempted: false,
  });

  assert.equal(decision, 'allow');
});

test('protected route redirects after server restore has already failed', () => {
  const decision = resolveProtectedRouteAuthDecision({
    currentUserRole: 'public',
    isAuthenticated: false,
    isRestoringSession: false,
    requiresAuth: true,
    restoreAttempted: true,
  });

  assert.equal(decision, 'redirect');
});
