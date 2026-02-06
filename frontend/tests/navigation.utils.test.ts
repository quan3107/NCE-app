/**
 * Location: tests/navigation.utils.test.ts
 * Purpose: Validate icon mapping and permission helper logic.
 * Why: Ensures navigation rendering and filtering behavior stays predictable.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Circle, Home } from 'lucide-react';

import { getIcon } from '../src/features/navigation/utils/iconMap';
import {
  hasAllPermissions,
  hasAnyPermission,
  hasPermission,
} from '../src/features/navigation/hooks/usePermissions';

test('getIcon returns mapped icon and falls back to Circle', () => {
  assert.equal(getIcon('home'), Home);
  assert.equal(getIcon('not-a-real-icon'), Circle);
});

test('permission helpers return expected boolean results', () => {
  const permissions = ['dashboard:view', 'assignments:read', 'profile:view'];

  assert.equal(hasPermission('dashboard:view', permissions), true);
  assert.equal(hasPermission('users:manage', permissions), false);
  assert.equal(hasPermission(null, permissions), true);

  assert.equal(hasAnyPermission(['users:manage', 'assignments:read'], permissions), true);
  assert.equal(hasAnyPermission(['users:manage', 'courses:manage'], permissions), false);

  assert.equal(hasAllPermissions(['dashboard:view', 'profile:view'], permissions), true);
  assert.equal(hasAllPermissions(['dashboard:view', 'users:manage'], permissions), false);
});
