/// <reference lib="dom" />
/**
 * Location: tests/courseTabsConfig.api.test.ts
 * Purpose: Validate course management tab config API mapping and error behavior.
 * Why: Prevents bundled course tabs from hiding backend config failures.
 */

import assert from 'node:assert/strict';
import { before, test } from 'node:test';

const API_BASE_URL = 'http://localhost:4000/api/v1';

type FetchCourseManagementTabs =
  typeof import('../src/features/courses/management/courseTabs.config.api').fetchCourseManagementTabs;

let fetchCourseManagementTabs: FetchCourseManagementTabs;

before(async () => {
  if (typeof process !== 'undefined' && process.env) {
    process.env.VITE_API_BASE_URL = API_BASE_URL;
  }

  const module = await import('../src/features/courses/management/courseTabs.config.api');
  fetchCourseManagementTabs = module.fetchCourseManagementTabs;
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
    (globalThis as typeof globalThis & { localStorage: Storage }).localStorage =
      overrides.localStorage;
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

test('fetchCourseManagementTabs maps backend payload', async () => {
  await withPatchedGlobals(
    {
      fetch: async () =>
        new Response(
          JSON.stringify({
            tabs: [
              {
                id: 'students',
                label: 'Students',
                icon: 'users',
                required_permission: 'courses:manage',
                order: 2,
                enabled: true,
              },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      localStorage: createStorage(),
    },
    async () => {
      const tabs = await fetchCourseManagementTabs();

      assert.equal(tabs.length, 1);
      assert.equal(tabs[0].id, 'students');
      assert.equal(tabs[0].requiredPermission, 'courses:manage');
    },
  );
});

test('fetchCourseManagementTabs rejects when endpoint fails', async () => {
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
      await assert.rejects(fetchCourseManagementTabs(), /Service unavailable/);
    },
  );
});
