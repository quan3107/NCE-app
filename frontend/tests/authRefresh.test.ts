/**
 * Location: tests/authRefresh.test.ts
 * Purpose: Verify refresh failure race handling.
 * Why: Prevents a stale failed refresh from clearing an already-restored session.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { shouldClearSessionAfterRefreshFailure } from '../src/lib/auth-refresh';

test('clears the live session when the failed refresh still owns the current token', () => {
  assert.equal(shouldClearSessionAfterRefreshFailure('stale-token', 'stale-token'), true);
});

test('keeps the live session when another refresh already applied a newer token', () => {
  assert.equal(shouldClearSessionAfterRefreshFailure('stale-token', 'fresh-token'), false);
});
