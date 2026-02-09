/**
 * Location: tests/notifications.api.test.ts
 * Purpose: Validate notification API mapping behavior for backend-provided types.
 * Why: Prevents regressions that coerce unknown backend types into hardcoded defaults.
 */

import assert from 'node:assert/strict';
import { before, test } from 'node:test';

type MapApiNotificationToNotification =
  typeof import('../src/features/notifications/api').mapApiNotificationToNotification;
let mapApiNotificationToNotification: MapApiNotificationToNotification;

before(async () => {
  const module = await import('../src/features/notifications/api');
  mapApiNotificationToNotification = module.mapApiNotificationToNotification;
});

test('mapApiNotificationToNotification preserves unknown backend types', () => {
  const mapped = mapApiNotificationToNotification({
    id: 'n-1',
    userId: 'u-1',
    type: 'weekly_digest',
    payload: {},
    channel: 'inapp',
    status: 'queued',
    createdAt: '2026-02-09T00:00:00.000Z',
  });

  assert.equal(mapped.type, 'weekly_digest');
  assert.equal(mapped.title, 'weekly digest');
});

test('mapApiNotificationToNotification uses payload title/message when provided', () => {
  const mapped = mapApiNotificationToNotification({
    id: 'n-2',
    userId: 'u-1',
    type: 'due_soon',
    payload: {
      title: 'Due in 24h',
      message: 'Please submit before midnight.',
    },
    channel: 'inapp',
    status: 'read',
    readAt: '2026-02-09T10:00:00.000Z',
    createdAt: '2026-02-09T00:00:00.000Z',
  });

  assert.equal(mapped.title, 'Due in 24h');
  assert.equal(mapped.message, 'Please submit before midnight.');
  assert.equal(mapped.read, true);
});
