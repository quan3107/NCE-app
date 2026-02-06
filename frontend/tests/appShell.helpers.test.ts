/**
 * Location: tests/appShell.helpers.test.ts
 * Purpose: Verify helper behavior shared by AppShell public/authenticated layouts.
 * Why: Guards role path resolution and badge-source count mapping used in Phase 3 wiring.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  DASHBOARD_PATH_BY_ROLE,
  getBadgeCountForSource,
  resolveProfilePath,
} from '../src/components/layout/appShell.helpers';

test('dashboard paths map correctly for all roles', () => {
  assert.equal(DASHBOARD_PATH_BY_ROLE.student, '/student/dashboard');
  assert.equal(DASHBOARD_PATH_BY_ROLE.teacher, '/teacher/dashboard');
  assert.equal(DASHBOARD_PATH_BY_ROLE.admin, '/admin/dashboard');
  assert.equal(DASHBOARD_PATH_BY_ROLE.public, '/');
});

test('resolveProfilePath returns expected route per role', () => {
  assert.equal(resolveProfilePath('student'), '/student/profile');
  assert.equal(resolveProfilePath('teacher'), '/teacher/profile');
  assert.equal(resolveProfilePath('admin'), null);
  assert.equal(resolveProfilePath('public'), null);
});

test('getBadgeCountForSource returns 0 for null and maps known badge sources', () => {
  const badgeCounts = {
    notifications: 4,
    assignments: 2,
    submissions: 7,
  };

  assert.equal(getBadgeCountForSource(null, badgeCounts), 0);
  assert.equal(getBadgeCountForSource('notifications', badgeCounts), 4);
  assert.equal(getBadgeCountForSource('assignments', badgeCounts), 2);
  assert.equal(getBadgeCountForSource('submissions', badgeCounts), 7);
});
