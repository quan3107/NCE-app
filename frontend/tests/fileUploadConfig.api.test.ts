/// <reference lib="dom" />
/**
 * Location: tests/fileUploadConfig.api.test.ts
 * Purpose: Validate file upload config API normalization and fallback behavior.
 * Why: Ensures role-based upload policy reads remain resilient when config endpoints fail.
 */

import assert from 'node:assert/strict';
import { before, test } from 'node:test';

const API_BASE_URL = 'http://localhost:4000/api/v1';

type FetchFileUploadConfig = typeof import('../src/features/files/configApi').fetchFileUploadConfig;
let fetchFileUploadConfig: FetchFileUploadConfig;

before(async () => {
  if (typeof process !== 'undefined' && process.env) {
    process.env.VITE_API_BASE_URL = API_BASE_URL;
  }

  const module = await import('../src/features/files/configApi');
  fetchFileUploadConfig = module.fetchFileUploadConfig;
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

test('fetchFileUploadConfig maps API payloads into runtime policy', async () => {
  await withPatchedGlobals(
    {
      fetch: async (input) => {
        const url = typeof input === 'string' ? input : input.toString();

        if (url.endsWith('/config/file-upload-limits')) {
          return new Response(
            JSON.stringify({
              limits: {
                max_file_size: 1024,
                max_total_size: 2048,
                max_files_per_upload: 2,
              },
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          );
        }

        if (url.endsWith('/config/allowed-file-types')) {
          return new Response(
            JSON.stringify({
              allowed_types: [
                {
                  mime_type: 'application/pdf',
                  extensions: ['.pdf'],
                  label: 'PDF Document',
                  accept_token: '.pdf',
                },
              ],
              accept: '.pdf',
              type_label: 'PDF files',
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          );
        }

        throw new Error(`Unexpected fetch ${url}`);
      },
      localStorage: createStorage(),
    },
    async () => {
      const config = await fetchFileUploadConfig();

      assert.equal(config.limits.maxFileSize, 1024);
      assert.equal(config.limits.maxTotalSize, 2048);
      assert.equal(config.limits.maxFilesPerUpload, 2);
      assert.equal(config.accept, '.pdf');
      assert.equal(config.typeLabel, 'PDF files');
      assert.equal(config.allowedMimeTypes.has('application/pdf'), true);
      assert.equal(config.allowedExtensions.has('.pdf'), true);
    },
  );
});

test('fetchFileUploadConfig falls back when config endpoint fails', async () => {
  await withPatchedGlobals(
    {
      fetch: async (input) => {
        const url = typeof input === 'string' ? input : input.toString();

        if (url.endsWith('/config/file-upload-limits')) {
          return new Response(
            JSON.stringify({
              limits: {
                max_file_size: 1,
                max_total_size: 2,
                max_files_per_upload: 1,
              },
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          );
        }

        if (url.endsWith('/config/allowed-file-types')) {
          return new Response(
            JSON.stringify({ message: 'Service unavailable' }),
            { status: 503, headers: { 'content-type': 'application/json' } },
          );
        }

        throw new Error(`Unexpected fetch ${url}`);
      },
      localStorage: createStorage(),
    },
    async () => {
      const config = await fetchFileUploadConfig();

      assert.equal(config.limits.maxFileSize, 25 * 1024 * 1024);
      assert.equal(config.limits.maxTotalSize, 100 * 1024 * 1024);
      assert.equal(config.accept, '.pdf,.doc,.docx,audio/*,image/*');
      assert.equal(config.typeLabel, 'PDF, DOC, DOCX, audio, or image files');
    },
  );
});
