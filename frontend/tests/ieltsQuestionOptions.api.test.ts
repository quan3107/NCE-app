/// <reference lib="dom" />
/**
 * Location: tests/ieltsQuestionOptions.api.test.ts
 * Purpose: Validate IELTS question option API mapping, fallback, and value normalization.
 * Why: Prevents regressions when replacing hardcoded option arrays with backend-driven values.
 */

import assert from 'node:assert/strict';
import { before, test } from 'node:test';

const API_BASE_URL = 'http://localhost:4000/api/v1';

type FetchQuestionOptions = typeof import('../src/features/ielts-config/questionOptions.api').fetchQuestionOptions;
type NormalizeQuestionOptionValue =
  typeof import('../src/features/ielts-config/questionOptions.api').normalizeQuestionOptionValue;

let fetchQuestionOptions: FetchQuestionOptions;
let normalizeQuestionOptionValue: NormalizeQuestionOptionValue;

before(async () => {
  if (typeof process !== 'undefined' && process.env) {
    process.env.VITE_API_BASE_URL = API_BASE_URL;
  }

  const module = await import('../src/features/ielts-config/questionOptions.api');
  fetchQuestionOptions = module.fetchQuestionOptions;
  normalizeQuestionOptionValue = module.normalizeQuestionOptionValue;
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

test('fetchQuestionOptions maps API payload and normalizes legacy not given value', async () => {
  await withPatchedGlobals(
    {
      fetch: async (input) => {
        const url = typeof input === 'string' ? input : input.toString();

        assert.match(url, /\/config\/ielts\/question-options\?type=true_false/);

        return new Response(
          JSON.stringify({
            type: 'true_false',
            version: 4,
            options: [
              { value: 'true', label: 'True', score: 1, enabled: true, sort_order: 1 },
              { value: 'not given', label: 'Not Given', score: 0, enabled: true, sort_order: 2 },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      },
      localStorage: createStorage(),
    },
    async () => {
      const payload = await fetchQuestionOptions('true_false');

      assert.equal(payload.type, 'true_false');
      assert.equal(payload.version, 4);
      assert.equal(payload.options[1].value, 'not_given');
    },
  );
});

test('fetchQuestionOptions falls back when endpoint fails', async () => {
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
      const payload = await fetchQuestionOptions('yes_no');

      assert.equal(payload.type, 'yes_no');
      assert.equal(payload.options.length, 3);
      assert.equal(payload.options[2].value, 'not_given');
    },
  );
});

test('normalizeQuestionOptionValue normalizes both legacy and canonical not-given values', () => {
  assert.equal(normalizeQuestionOptionValue('not given'), 'not_given');
  assert.equal(normalizeQuestionOptionValue('Not_Given'), 'not_given');
  assert.equal(normalizeQuestionOptionValue('true'), 'true');
  assert.equal(normalizeQuestionOptionValue('unexpected'), 'unexpected');
});
