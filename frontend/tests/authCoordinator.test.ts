/**
 * Location: tests/authCoordinator.test.ts
 * Purpose: Verify the in-memory auth coordinator's authority and request fences.
 * Why: Browser storage and delayed responses must never replace the active actor.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { AuthCoordinator } from '../src/lib/auth-coordinator';

test('bootstrap is the only path from booting to anonymous', async () => {
  const coordinator = new AuthCoordinator();
  assert.equal(coordinator.getSnapshot().status, 'booting');

  const readiness = coordinator.waitUntilReady();
  coordinator.finishBootstrap();
  await readiness;

  assert.deepEqual(coordinator.getSnapshot(), {
    status: 'anonymous',
    revision: 1,
  });
});

test('authenticated transitions abort admitted requests', () => {
  const coordinator = new AuthCoordinator();
  coordinator.finishBootstrap();
  coordinator.authenticate('token-a', { id: 'user-a', role: 'student' });
  const admission = coordinator.admit('required');
  assert.equal(admission.actorId, 'user-a');
  assert.equal(admission.signal.aborted, false);

  coordinator.authenticate('token-b', { id: 'user-b', role: 'teacher' });
  assert.equal(admission.signal.aborted, true);
  assert.equal(coordinator.getSnapshot().status, 'authenticated');
});

test('same-actor refresh rotates only the memory token', () => {
  const coordinator = new AuthCoordinator();
  coordinator.finishBootstrap();
  coordinator.authenticate('token-a', { id: 'user-a', role: 'student' });
  const revision = coordinator.getSnapshot().revision;

  assert.equal(
    coordinator.replaceToken(revision, 'user-a', 'token-a2'),
    true,
  );
  assert.equal(coordinator.admit('required').accessToken, 'token-a2');
  assert.equal(coordinator.getSnapshot().revision, revision);
});

test('same-actor session replacement aborts older admitted work', () => {
  const coordinator = new AuthCoordinator();
  coordinator.finishBootstrap();
  coordinator.authenticate('token-a', { id: 'user-a', role: 'student' });
  const admission = coordinator.admit('required');
  const revision = admission.revision;

  coordinator.authenticate('token-new-login', {
    id: 'user-a',
    role: 'student',
  });

  assert.equal(admission.signal.aborted, true);
  assert.equal(coordinator.getSnapshot().revision, revision + 1);
});
