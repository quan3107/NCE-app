/**
 * Location: tests/apiClient.test.ts
 * Purpose: Verify apiClient auth header behavior and retry handling.
 * Why: Prevents regressions in auth wiring and retry logic.
 */

import assert from 'node:assert/strict';
import { before, test } from 'node:test';
type ApiClientFn = typeof import('../src/lib/apiClient').apiClient;
type AuthBridgeInstance = typeof import('../src/lib/authBridge').authBridge;

const API_BASE_URL = 'http://localhost:4000/api/v1';

let apiClient: ApiClientFn;
let authBridge: AuthBridgeInstance;

before(async () => {
  if (typeof process !== 'undefined' && process.env) {
    process.env.VITE_API_BASE_URL = API_BASE_URL;
  }

  const apiModule = await import('../src/lib/apiClient');
  apiClient = apiModule.apiClient;

  const authModule = await import('../src/lib/authBridge');
  authBridge = authModule.authBridge;
});

type StorageRecord = Record<string, string>;

const createStorage = (entries: StorageRecord = {}): Storage => {
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

const withPatchedGlobals = async (
  overrides: {
    fetch?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
    localStorage?: Storage;
  },
  run: () => Promise<void>,
) => {
  const originalFetch = globalThis.fetch;
  const originalLocalStorage = (globalThis as Record<string, unknown>).localStorage;

  if (overrides.fetch) {
    (globalThis as typeof globalThis & { fetch: typeof fetch }).fetch = overrides.fetch;
  }
  if (overrides.localStorage) {
    (globalThis as typeof globalThis & { localStorage: Storage }).localStorage =
      overrides.localStorage;
  }

  try {
    await run();
  } finally {
    authBridge.reset();
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
  }
};

test('apiClient attaches bearer token supplied by authBridge', async () => {
  let capturedHeaders: Headers | null = null;
  let callCount = 0;

  await withPatchedGlobals(
    {
      fetch: async (_input, init) => {
        callCount += 1;
        capturedHeaders = new Headers(init?.headers);
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      },
      localStorage: createStorage(),
    },
    async () => {
      authBridge.configure({
        getAccessToken: () => 'live-token',
        refreshAccessToken: async () => null,
        clearSession: () => {},
      });

      const result = await apiClient<{ ok: boolean }>('/sample');
      assert.equal(result.ok, true);
      assert.equal(callCount, 1);
      assert.equal(capturedHeaders?.get('authorization'), 'Bearer live-token');
    },
  );
});

test('apiClient ignores stored persona headers when dev fallback is disabled', async () => {
  let capturedHeaders: Headers | null = null;

  const storedPayload = JSON.stringify({
    mode: 'persona',
    token: 'dev-teacher-token',
    persona: {
      basePersona: 'teacher',
      actingPersona: null,
    },
  });

  await withPatchedGlobals(
    {
      fetch: async (_input, init) => {
        capturedHeaders = new Headers(init?.headers);
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      },
      localStorage: createStorage({
        currentUser: storedPayload,
      }),
    },
    async () => {
      authBridge.configure({
        getAccessToken: () => null,
        refreshAccessToken: async () => null,
        clearSession: () => {},
      });

      await apiClient('/persona');
      assert.equal(capturedHeaders?.get('authorization'), null);
      assert.equal(capturedHeaders?.get('x-user-role'), null);
      assert.equal(capturedHeaders?.get('x-user-id'), null);
    },
  );
});

test('apiClient retries once on 401 when refresh succeeds', async () => {
  let callCount = 0;
  let cleared = false;
  let currentToken = 'stale-token';

  await withPatchedGlobals(
    {
      fetch: async (_input, init) => {
        callCount += 1;
        const headers = new Headers(init?.headers);
        if (callCount === 1) {
          assert.equal(headers.get('authorization'), 'Bearer stale-token');
          return new Response('', { status: 401 });
        }

        assert.equal(headers.get('authorization'), 'Bearer fresh-token');
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      },
      localStorage: createStorage(),
    },
    async () => {
      authBridge.configure({
        getAccessToken: () => currentToken,
        refreshAccessToken: async () => {
          currentToken = 'fresh-token';
          return currentToken;
        },
        clearSession: () => {
          cleared = true;
        },
      });

      const result = await apiClient<{ ok: boolean }>('/secure');
      assert.equal(result.ok, true);
      assert.equal(callCount, 2);
      assert.equal(cleared, false);
    },
  );
});

test('apiClient does not clear persona session on 401 without bearer auth', async () => {
  let cleared = false;

  const storedPayload = JSON.stringify({
    mode: 'persona',
    token: 'dev-admin-token',
    persona: {
      basePersona: 'admin',
      actingPersona: null,
    },
  });

  await withPatchedGlobals(
    {
      fetch: async () => new Response('', { status: 401, statusText: 'Unauthorized' }),
      localStorage: createStorage({
        currentUser: storedPayload,
      }),
    },
    async () => {
      authBridge.configure({
        getAccessToken: () => null,
        refreshAccessToken: async () => null,
        clearSession: () => {
          cleared = true;
        },
      });

      await assert.rejects(
        () => apiClient('/persona-protected'),
        (error: unknown) =>
          error instanceof Error &&
          error.message.includes('Unauthorized') &&
          (error as { status?: number }).status === 401,
      );

      assert.equal(cleared, false);
    },
  );
});
