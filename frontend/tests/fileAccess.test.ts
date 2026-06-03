/// <reference lib="dom" />
/**
 * Location: tests/fileAccess.test.ts
 * Purpose: Verify signed file download helpers call the backend contract and open signed URLs.
 * Why: Keeps student and teacher file actions aligned with authorized file access.
 */

import assert from 'node:assert/strict';
import { before, test } from 'node:test';

const API_BASE_URL = 'http://localhost:4000/api/v1';

let requestSignedFileDownload: typeof import('../src/features/files/fileAccess').requestSignedFileDownload;
let openSignedFileDownload: typeof import('../src/features/files/fileAccess').openSignedFileDownload;

before(async () => {
  if (typeof process !== 'undefined' && process.env) {
    process.env.VITE_API_BASE_URL = API_BASE_URL;
  }

  const fileAccessModule = await import('../src/features/files/fileAccess');
  requestSignedFileDownload = fileAccessModule.requestSignedFileDownload;
  openSignedFileDownload = fileAccessModule.openSignedFileDownload;
});

const withPatchedFetch = async (
  fetchImpl: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
  run: () => Promise<void>,
) => {
  const originalFetch = globalThis.fetch;
  (globalThis as typeof globalThis & { fetch: typeof fetch }).fetch = fetchImpl;

  try {
    await run();
  } finally {
    (globalThis as typeof globalThis & { fetch: typeof fetch }).fetch = originalFetch;
  }
};

test('requestSignedFileDownload calls the signed download endpoint', async () => {
  let requestedUrl = '';

  await withPatchedFetch(
    async (input) => {
      requestedUrl = typeof input === 'string' ? input : input.toString();
      return new Response(
        JSON.stringify({
          url: 'https://storage.mock/nce-mock-uploads/uploads/student/essay.pdf',
          method: 'GET',
          headers: {},
          fileName: 'essay.pdf',
          mime: 'application/pdf',
          size: 512,
          expiresAt: '2026-01-01T00:15:00.000Z',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    },
    async () => {
      const result = await requestSignedFileDownload('file-123');

      assert.equal(requestedUrl, `${API_BASE_URL}/files/file-123/download`);
      assert.equal(result.fileName, 'essay.pdf');
      assert.equal(result.method, 'GET');
      assert.equal(result.size, 512);
    },
  );
});

test('openSignedFileDownload navigates a placeholder tab to the signed URL', async () => {
  const openedTargets: Array<{ url: string; target: string; features: string }> = [];
  const placeholder = { location: { href: 'about:blank' } } as Window;

  await withPatchedFetch(
    async () =>
      new Response(
        JSON.stringify({
          url: 'https://storage.mock/nce-mock-uploads/uploads/student/essay.pdf',
          method: 'GET',
          headers: {},
          fileName: 'essay.pdf',
          mime: 'application/pdf',
          size: 512,
          expiresAt: '2026-01-01T00:15:00.000Z',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    async () => {
      const result = await openSignedFileDownload(
        {
          id: 'file-123',
          name: 'essay.pdf',
          size: 512,
          mime: 'application/pdf',
          checksum: 'checksum',
          bucket: 'nce-mock-uploads',
          objectKey: 'uploads/student/essay.pdf',
        },
        (url, target, features) => {
          openedTargets.push({ url, target, features });
          return placeholder;
        },
      );

      assert.equal(result.url, 'https://storage.mock/nce-mock-uploads/uploads/student/essay.pdf');
      assert.deepEqual(openedTargets, [
        {
          url: 'about:blank',
          target: '_blank',
          features: 'noopener,noreferrer',
        },
      ]);
      assert.equal(
        placeholder.location.href,
        'https://storage.mock/nce-mock-uploads/uploads/student/essay.pdf',
      );
    },
  );
});

test('openSignedFileDownload throws when the placeholder tab is blocked', async () => {
  await assert.rejects(
    openSignedFileDownload(
      {
        id: 'file-123',
        name: 'essay.pdf',
        size: 512,
        mime: 'application/pdf',
        checksum: 'checksum',
        bucket: 'nce-mock-uploads',
        objectKey: 'uploads/student/essay.pdf',
      },
      () => null,
    ),
    /Allow popups to open file downloads/,
  );
});
