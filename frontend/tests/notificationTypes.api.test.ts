/// <reference lib="dom" />
/**
 * Location: tests/notificationTypes.api.test.ts
 * Purpose: Validate notification type config API mapping, fallback behavior, and logging.
 * Why: Ensures fallback paths are explicit when backend config data is unavailable.
 */

import assert from 'node:assert/strict';
import { before, test } from 'node:test';

const API_BASE_URL = 'http://localhost:4000/api/v1';

type FetchNotificationTypes =
  typeof import('../src/features/notifications/config.api').fetchNotificationTypes;
let fetchNotificationTypes: FetchNotificationTypes;

before(async () => {
  if (typeof process !== 'undefined' && process.env) {
    process.env.VITE_API_BASE_URL = API_BASE_URL;
  }

  const module = await import('../src/features/notifications/config.api');
  fetchNotificationTypes = module.fetchNotificationTypes;
});

const createStorage = (): Storage => ({
  get length() {
    return 0;
  },
  clear: () => undefined,
  getItem: () => null,
  key: () => null,
  removeItem: () => undefined,
  setItem: () => undefined,
});

const withPatchedGlobals = async (
  overrides: {
    fetch?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
    localStorage?: Storage;
    warn?: (...args: unknown[]) => void;
    error?: (...args: unknown[]) => void;
  },
  run: () => Promise<void>,
) => {
  const originalFetch = globalThis.fetch;
  const originalLocalStorage = (globalThis as Record<string, unknown>).localStorage;
  const originalWarn = console.warn;
  const originalError = console.error;

  if (overrides.fetch) {
    (globalThis as typeof globalThis & { fetch: typeof fetch }).fetch = overrides.fetch;
  }

  if (overrides.localStorage) {
    (globalThis as typeof globalThis & { localStorage: Storage }).localStorage =
      overrides.localStorage;
  }

  if (overrides.warn) {
    console.warn = overrides.warn as typeof console.warn;
  }

  if (overrides.error) {
    console.error = overrides.error as typeof console.error;
  }

  try {
    await run();
  } finally {
    if (overrides.fetch) {
      (globalThis as typeof globalThis & { fetch: typeof fetch }).fetch = originalFetch;
    }

    if (overrides.localStorage) {
      if (originalLocalStorage === undefined) {
        delete (globalThis as Record<string, unknown>).localStorage;
      } else {
        (globalThis as typeof globalThis & { localStorage: Storage }).localStorage =
          originalLocalStorage as Storage;
      }
    }

    console.warn = originalWarn;
    console.error = originalError;
  }
};

test('fetchNotificationTypes maps backend payload into runtime config', async () => {
  await withPatchedGlobals(
    {
      fetch: async (input) => {
        const url = typeof input === 'string' ? input : input.toString();
        assert.match(url, /\/config\/notification-types$/);

        return new Response(
          JSON.stringify({
            types: [
              {
                id: 'graded',
                label: 'Graded',
                description: 'Grade released',
                category: 'grading',
                default_enabled: true,
                enabled: true,
                sort_order: 3,
              },
              {
                id: 'due_soon',
                label: 'Due Soon',
                description: 'Deadline approaching',
                category: 'assignments',
                default_enabled: true,
                enabled: true,
                sort_order: 2,
              },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      },
      localStorage: createStorage(),
    },
    async () => {
      const types = await fetchNotificationTypes();
      assert.equal(types.length, 2);
      assert.equal(types[0].id, 'due_soon');
      assert.equal(types[1].id, 'graded');
    },
  );
});

test('fetchNotificationTypes logs warning and falls back when payload is invalid', async () => {
  const warnings: unknown[][] = [];

  await withPatchedGlobals(
    {
      fetch: async () =>
        new Response(JSON.stringify({ types: [{ id: '', label: '' }] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      localStorage: createStorage(),
      warn: (...args: unknown[]) => {
        warnings.push(args);
      },
    },
    async () => {
      const types = await fetchNotificationTypes();
      assert.equal(types.length >= 4, true);
      assert.equal(types[0].id, 'assignment_published');
    },
  );

  assert.equal(warnings.length > 0, true);
  assert.equal(
    String(warnings[0][0]).includes(
      '[notifications] invalid notification types payload; using fallback',
    ),
    true,
  );
});

test('fetchNotificationTypes logs error and falls back when request fails', async () => {
  const errors: unknown[][] = [];

  await withPatchedGlobals(
    {
      fetch: async () =>
        new Response(JSON.stringify({ message: 'Service unavailable' }), {
          status: 503,
          headers: { 'content-type': 'application/json' },
        }),
      localStorage: createStorage(),
      error: (...args: unknown[]) => {
        errors.push(args);
      },
    },
    async () => {
      const types = await fetchNotificationTypes();
      assert.equal(types.length >= 4, true);
      assert.equal(types[1].id, 'due_soon');
    },
  );

  assert.equal(errors.length > 0, true);
  assert.equal(
    String(errors[0][0]).includes(
      '[notifications] backend notification types unavailable; using fallback',
    ),
    true,
  );
});

test('fetchNotificationTypes teacher fallback excludes graded type', async () => {
  await withPatchedGlobals(
    {
      fetch: async () =>
        new Response(JSON.stringify({ message: 'Service unavailable' }), {
          status: 503,
          headers: { 'content-type': 'application/json' },
        }),
      localStorage: createStorage(),
    },
    async () => {
      const types = await fetchNotificationTypes('teacher');
      assert.equal(types.some((type) => type.id === 'graded'), false);
      assert.deepEqual(
        types.map((type) => type.id),
        ['new_submission', 'reminder', 'weekly_digest'],
      );
    },
  );
});
