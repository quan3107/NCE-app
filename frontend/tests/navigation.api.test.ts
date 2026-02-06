/// <reference lib="dom" />
/**
 * Location: tests/navigation.api.test.ts
 * Purpose: Validate navigation API mapping and count endpoint error normalization.
 * Why: Protects the contract between /me payload parsing and badge fetch behavior.
 */

import assert from 'node:assert/strict';
import { before, test } from 'node:test';

const API_BASE_URL = 'http://localhost:4000/api/v1';

type FetchNavigationFromMe = typeof import('../src/features/navigation/api').fetchNavigationFromMe;
type FetchAssignmentsPendingCount =
  typeof import('../src/features/navigation/api').fetchAssignmentsPendingCount;
type FetchSubmissionsPendingCount =
  typeof import('../src/features/navigation/api').fetchSubmissionsPendingCount;

let fetchNavigationFromMe: FetchNavigationFromMe;
let fetchAssignmentsPendingCount: FetchAssignmentsPendingCount;
let fetchSubmissionsPendingCount: FetchSubmissionsPendingCount;

before(async () => {
  if (typeof process !== 'undefined' && process.env) {
    process.env.VITE_API_BASE_URL = API_BASE_URL;
  }

  const module = await import('../src/features/navigation/api');
  fetchNavigationFromMe = module.fetchNavigationFromMe;
  fetchAssignmentsPendingCount = module.fetchAssignmentsPendingCount;
  fetchSubmissionsPendingCount = module.fetchSubmissionsPendingCount;
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
  },
  run: () => Promise<void>,
) => {
  const originalFetch = globalThis.fetch;
  const originalLocalStorage = (globalThis as Record<string, unknown>).localStorage;

  if (overrides.fetch) {
    (globalThis as typeof globalThis & { fetch: typeof fetch }).fetch = overrides.fetch;
  }

  if (overrides.localStorage) {
    (globalThis as typeof globalThis & { localStorage: Storage }).localStorage = overrides.localStorage;
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
  }
};

test('fetchNavigationFromMe extracts validated navigation payload', async () => {
  await withPatchedGlobals(
    {
      fetch: async () =>
        new Response(
          JSON.stringify({
            navigation: {
              items: [],
              permissions: ['dashboard:view'],
              featureFlags: { 'ielts-speaking-module': true },
              version: '2025-02-05-001',
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      localStorage: createStorage(),
    },
    async () => {
      const payload = await fetchNavigationFromMe();

      assert.equal(payload.version, '2025-02-05-001');
      assert.deepEqual(payload.permissions, ['dashboard:view']);
      assert.equal(payload.featureFlags['ielts-speaking-module'], true);
    },
  );
});

test('fetchNavigationFromMe throws when navigation payload is invalid', async () => {
  await withPatchedGlobals(
    {
      fetch: async () =>
        new Response(
          JSON.stringify({
            navigation: {
              items: 'invalid',
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      localStorage: createStorage(),
    },
    async () => {
      await assert.rejects(
        () => fetchNavigationFromMe(),
        (error: unknown) =>
          error instanceof Error &&
          error.message.includes('Invalid navigation payload returned by /api/v1/me'),
      );
    },
  );
});

test('count endpoint helpers normalize API errors into typed failure results', async () => {
  await withPatchedGlobals(
    {
      fetch: async (input) => {
        const url = typeof input === 'string' ? input : input.toString();

        if (url.endsWith('/assignments/pending-count')) {
          return new Response(JSON.stringify({ message: 'Assignments endpoint missing' }), {
            status: 404,
            headers: { 'content-type': 'application/json' },
          });
        }

        if (url.endsWith('/submissions/pending-count')) {
          return new Response(JSON.stringify({ message: 'Submissions endpoint missing' }), {
            status: 503,
            headers: { 'content-type': 'application/json' },
          });
        }

        return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
      },
      localStorage: createStorage(),
    },
    async () => {
      const assignmentsResult = await fetchAssignmentsPendingCount();
      const submissionsResult = await fetchSubmissionsPendingCount();

      assert.deepEqual(assignmentsResult, {
        ok: false,
        error: 'Assignments endpoint missing',
        status: 404,
      });

      assert.deepEqual(submissionsResult, {
        ok: false,
        error: 'Submissions endpoint missing',
        status: 503,
      });
    },
  );
});
