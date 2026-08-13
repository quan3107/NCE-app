/**
 * Location: tests/authSessionScope.test.ts
 * Purpose: Verify actor transitions isolate authenticated query data.
 * Why: Account, role, and logout changes must clear private cache without penalizing token refresh.
 */

import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import { enterActorScope } from '../src/lib/auth-session';
import type { AuthMachineState } from '../src/lib/auth-machine';
import { queryClient } from '../src/lib/queryClient';

const authenticated = (
  revision: number,
  id: string,
  role: 'student' | 'teacher' | 'admin',
  accessToken: string,
): AuthMachineState => ({
  status: 'authenticated',
  revision,
  accessToken,
  actor: { id, role },
});

afterEach(() => queryClient.clear());

test('account, role, and logout transitions clear actor-scoped queries', () => {
  const student = authenticated(1, 'user-a', 'student', 'token-a');
  const teacher = authenticated(2, 'user-a', 'teacher', 'token-b');
  queryClient.setQueryData(['private'], 'student-data');
  assert.equal(enterActorScope(student, teacher), true);
  assert.equal(queryClient.getQueryData(['private']), undefined);

  queryClient.setQueryData(['private'], 'teacher-data');
  const anonymous: AuthMachineState = { status: 'anonymous', revision: 3 };
  assert.equal(enterActorScope(teacher, anonymous), true);
  assert.equal(queryClient.getQueryData(['private']), undefined);
});

test('same-actor token refresh preserves actor-scoped queries', () => {
  const before = authenticated(4, 'user-a', 'student', 'token-before');
  const after = authenticated(4, 'user-a', 'student', 'token-after');
  queryClient.setQueryData(['private'], 'cached-data');

  assert.equal(enterActorScope(before, after), false);
  assert.equal(queryClient.getQueryData(['private']), 'cached-data');
});
