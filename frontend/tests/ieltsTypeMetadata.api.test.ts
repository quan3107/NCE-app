/// <reference lib="dom" />
/**
 * Location: tests/ieltsTypeMetadata.api.test.ts
 * Purpose: Validate IELTS type metadata API mapping and error behavior.
 * Why: Prevents bundled IELTS type cards from hiding backend config failures.
 */

import assert from 'node:assert/strict';
import { before, test } from 'node:test';

const API_BASE_URL = 'http://localhost:4000/api/v1';

type FetchIeltsTypeMetadata =
  typeof import('../src/features/ielts-config/typeMetadata.api').fetchIeltsTypeMetadata;

let fetchIeltsTypeMetadata: FetchIeltsTypeMetadata;

before(async () => {
  if (typeof process !== 'undefined' && process.env) {
    process.env.VITE_API_BASE_URL = API_BASE_URL;
  }

  const module = await import('../src/features/ielts-config/typeMetadata.api');
  fetchIeltsTypeMetadata = module.fetchIeltsTypeMetadata;
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

test('fetchIeltsTypeMetadata maps backend payload', async () => {
  await withPatchedGlobals(
    {
      fetch: async () =>
        new Response(
          JSON.stringify({
            version: 1,
            types: [
              {
                id: 'writing',
                title: 'Writing',
                description: 'Write essays',
                icon: 'pen-tool',
                theme: {
                  color_from: '#ffffff',
                  color_to: '#eeeeee',
                  border_color: '#dddddd',
                },
                enabled: true,
                sort_order: 2,
              },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      localStorage: createStorage(),
    },
    async () => {
      const metadata = await fetchIeltsTypeMetadata();

      assert.equal(metadata.length, 1);
      assert.equal(metadata[0].id, 'writing');
      assert.equal(metadata[0].theme.borderColor, '#dddddd');
    },
  );
});

test('fetchIeltsTypeMetadata rejects when endpoint fails', async () => {
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
      await assert.rejects(fetchIeltsTypeMetadata(), /Service unavailable/);
    },
  );
});
