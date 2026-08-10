/**
 * Location: tests/apiClient.test.ts
 * Purpose: Verify apiClient auth header behavior and retry handling.
 * Why: Prevents regressions in auth wiring and retry logic.
 */

import assert from 'node:assert/strict';
import { before, test } from 'node:test';
type ApiClientFn = typeof import('../src/lib/apiClient').apiClient;
type AuthBridgeInstance = typeof import('../src/lib/authBridge').authBridge;
type AuthAdmission = import('../src/lib/auth-coordinator').AuthAdmission;

const API_BASE_URL = 'http://localhost:4000/api/v1';

let apiClient: ApiClientFn;
let authBridge: AuthBridgeInstance;
const testSignal = new AbortController().signal;
const admission = (accessToken: string | null): AuthAdmission => ({
  accessToken,
  actorId: accessToken ? 'test-user' : null,
  revision: 1,
  signal: testSignal,
});

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
        admit: () => admission('live-token'),
        isCurrent: () => true,
        refreshAccessToken: async () => ({ status: 'failed' }),
      });

      const result = await apiClient<{ ok: boolean }>('/sample', {
        auth: 'required',
      });
      assert.equal(result.ok, true);
      assert.equal(callCount, 1);
      assert.equal(capturedHeaders?.get('authorization'), 'Bearer live-token');
    },
  );
});

test('apiClient ignores stored snapshots without a live user', async () => {
  let capturedHeaders: Headers | null = null;

  const storedPayload = JSON.stringify({
    token: 'dev-teacher-token',
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
        admit: () => admission(null),
        isCurrent: () => true,
        refreshAccessToken: async () => ({ status: 'failed' }),
      });

      await apiClient('/stored-token', { auth: 'optional' });
      assert.equal(capturedHeaders?.get('authorization'), null);
      assert.equal(capturedHeaders?.get('x-user-role'), null);
      assert.equal(capturedHeaders?.get('x-user-id'), null);
    },
  );
});

test('apiClient never admits a stored admin token before bootstrap', async () => {
  let capturedHeaders: Headers | null = null;
  const storedPayload = JSON.stringify({
    token: 'stored-admin-token',
    liveUser: {
      id: 'admin-1',
      email: 'admin@example.com',
      name: 'Stored Admin',
      role: 'admin',
    },
    sessionEpoch: 42,
    profileRevision: 0,
  });

  await withPatchedGlobals(
    {
      fetch: async (_input, init) => {
        capturedHeaders = new Headers(init?.headers);
        return Response.json({ ok: true });
      },
      localStorage: createStorage({ currentUser: storedPayload }),
    },
    async () => {
      authBridge.configure({
        admit: () => admission(null),
        isCurrent: () => true,
        refreshAccessToken: async () => ({ status: 'failed' }),
      });

      await apiClient('/stored-admin', { auth: 'optional' });
      assert.equal(capturedHeaders?.get('authorization'), null);
    },
  );
});

test('optional auth waits for bootstrap before admitting a course request', async () => {
  let releaseBootstrap!: () => void;
  const bootstrap = new Promise<void>((resolve) => {
    releaseBootstrap = resolve;
  });
  let fetchCalls = 0;

  await withPatchedGlobals(
    {
      fetch: async () => {
        fetchCalls += 1;
        return Response.json({ courses: [] });
      },
      localStorage: createStorage(),
    },
    async () => {
      authBridge.configure({
        waitUntilReady: () => bootstrap,
        admit: () => admission('memory-token'),
        isCurrent: () => true,
      });

      const request = apiClient('/api/v1/courses', { auth: 'optional' });
      await Promise.resolve();
      assert.equal(fetchCalls, 0);
      releaseBootstrap();
      await request;
      assert.equal(fetchCalls, 1);
    },
  );
});

test('apiClient retries once with the exact token returned by refresh', async () => {
  let callCount = 0;
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
        admit: () => admission(currentToken),
        isCurrent: () => true,
        refreshAccessToken: async () => {
          currentToken = 'newer-session-token';
          return { status: 'refreshed', accessToken: 'fresh-token' };
        },
      });

      const result = await apiClient<{ ok: boolean }>('/secure', {
        auth: 'required',
      });
      assert.equal(result.ok, true);
      assert.equal(callCount, 2);
    },
  );
});

test('apiClient does not clear session on 401 without bearer auth', async () => {
  await withPatchedGlobals(
    {
      fetch: async () => new Response('', { status: 401, statusText: 'Unauthorized' }),
      localStorage: createStorage(),
    },
    async () => {
      authBridge.configure({
        admit: () => admission(null),
        isCurrent: () => true,
        refreshAccessToken: async () => ({ status: 'failed' }),
      });

      await assert.rejects(
        () => apiClient('/unauthenticated-protected', { auth: 'optional' }),
        (error: unknown) =>
          error instanceof Error &&
          error.message.includes('Unauthorized') &&
          (error as { status?: number }).status === 401,
      );
    },
  );
});

test('apiClient reports network failures as server unavailable', async () => {
  await withPatchedGlobals(
    {
      fetch: async () => {
        throw new TypeError('fetch failed');
      },
      localStorage: createStorage(),
    },
    async () => {
      await assert.rejects(
        () => apiClient('/server-down', { auth: 'none' }),
        (error: unknown) =>
          error instanceof Error &&
          error.message.includes('Server is unavailable') &&
          (error as { status?: number }).status === 0,
      );
    },
  );
});
