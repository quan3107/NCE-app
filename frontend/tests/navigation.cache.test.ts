/// <reference lib="dom" />
/**
 * Location: tests/navigation.cache.test.ts
 * Purpose: Verify navigation cache read/write/expiry behavior.
 * Why: Prevents stale or malformed localStorage data from breaking nav rendering.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { getFallbackNavigation } from '../src/features/navigation/utils/fallbackNav';
import {
  buildNavigationCacheKey,
  readNavigationCache,
  writeNavigationCache,
} from '../src/features/navigation/utils/cache';

const createStorage = (entries: Record<string, string> = {}): Storage => {
  const store = { ...entries };

  return {
    get length() {
      return Object.keys(store).length;
    },
    clear() {
      Object.keys(store).forEach((key) => {
        delete store[key];
      });
    },
    getItem(key: string) {
      return key in store ? store[key] : null;
    },
    key(index: number) {
      const keys = Object.keys(store);
      return keys[index] ?? null;
    },
    removeItem(key: string) {
      delete store[key];
    },
    setItem(key: string, value: string) {
      store[key] = value;
    },
  };
};

const withWindowStorage = async (storage: Storage, run: () => Promise<void> | void) => {
  const originalWindow = (globalThis as Record<string, unknown>).window;

  (globalThis as Record<string, unknown>).window = {
    localStorage: storage,
  } as Window;

  try {
    await run();
  } finally {
    if (originalWindow === undefined) {
      delete (globalThis as Record<string, unknown>).window;
    } else {
      (globalThis as Record<string, unknown>).window = originalWindow;
    }
  }
};

test('readNavigationCache returns valid cached payload', async () => {
  const identity = { userId: 'user-1', role: 'student' as const };
  const storage = createStorage();

  await withWindowStorage(storage, async () => {
    const payload = getFallbackNavigation('student');
    writeNavigationCache(identity, payload);

    const cached = readNavigationCache(identity);
    assert.deepEqual(cached, payload);
  });
});

test('readNavigationCache clears malformed JSON', async () => {
  const identity = { userId: 'user-2', role: 'teacher' as const };
  const key = buildNavigationCacheKey(identity);
  const storage = createStorage({
    [key]: '{invalid-json',
  });

  await withWindowStorage(storage, async () => {
    const cached = readNavigationCache(identity);
    assert.equal(cached, null);
    assert.equal(storage.getItem(key), null);
  });
});

test('readNavigationCache expires stale entries', async () => {
  const identity = { userId: 'user-3', role: 'admin' as const };
  const key = buildNavigationCacheKey(identity);
  const staleRecord = {
    data: getFallbackNavigation('admin'),
    role: identity.role,
    timestamp: Date.now() - 24 * 60 * 60 * 1000 - 1,
  };

  const storage = createStorage({
    [key]: JSON.stringify(staleRecord),
  });

  await withWindowStorage(storage, async () => {
    const cached = readNavigationCache(identity);
    assert.equal(cached, null);
    assert.equal(storage.getItem(key), null);
  });
});

test('teacher fallback navigation includes notifications entry', () => {
  const payload = getFallbackNavigation('teacher');
  const notificationsItem = payload.items.find((item) => item.path === '/teacher/notifications');

  assert.ok(notificationsItem);
  assert.equal(notificationsItem.label, 'Notifications');
  assert.equal(notificationsItem.badgeSource, 'notifications');
  assert.equal(notificationsItem.requiredPermission, 'notifications:read');
  assert.equal(notificationsItem.orderIndex, 4);
});
