/// <reference lib="dom" />
/**
 * Location: tests/fileUpload.test.ts
 * Purpose: Verify file upload helpers enforce type checks and formatting.
 * Why: Protects upload validation and size formatting from regressions.
 */

import assert from 'node:assert/strict';
import { before, test } from 'node:test';

const API_BASE_URL = 'http://localhost:4000/api/v1';

let formatFileSize: (bytes: number) => string;
let isAllowedFile: (file: Pick<File, 'name' | 'type'>) => { ok: boolean; reason?: string };
let uploadFileWithProgress: typeof import('../src/features/files/fileUpload').uploadFileWithProgress;

before(async () => {
  if (typeof process !== 'undefined' && process.env) {
    process.env.VITE_API_BASE_URL = API_BASE_URL;
  }

  const utilsModule = await import('../src/lib/utils');
  formatFileSize = utilsModule.formatFileSize;

  const fileModule = await import('../src/features/files/fileUpload');
  isAllowedFile = fileModule.isAllowedFile;
  uploadFileWithProgress = fileModule.uploadFileWithProgress;
});

test('formatFileSize renders bytes in human-friendly units', () => {
  assert.equal(formatFileSize(0), '0 B');
  assert.equal(formatFileSize(1024), '1.0 KB');
  assert.equal(formatFileSize(1024 * 1024), '1.0 MB');
  assert.equal(formatFileSize(10 * 1024 * 1024), '10 MB');
});

test('isAllowedFile accepts document and audio files', () => {
  const pdfFile = { name: 'essay.pdf', type: 'application/pdf' } as File;
  const docxFile = {
    name: 'draft.docx',
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  } as File;
  const audioFile = { name: 'response.mp3', type: 'audio/mpeg' } as File;
  const audioByExtension = { name: 'voice.m4a', type: '' } as File;

  assert.equal(isAllowedFile(pdfFile).ok, true);
  assert.equal(isAllowedFile(docxFile).ok, true);
  assert.equal(isAllowedFile(audioFile).ok, true);
  assert.equal(isAllowedFile(audioByExtension).ok, true);
});

test('isAllowedFile rejects unsupported files', () => {
  const exeFile = { name: 'script.exe', type: 'application/octet-stream' } as File;
  const result = isAllowedFile(exeFile);

  assert.equal(result.ok, false);
  assert.ok(result.reason?.includes('Unsupported'));
});

type MockProgressEvent = {
  lengthComputable: boolean;
  loaded: number;
  total: number;
};

class MockXMLHttpRequest {
  static nextStatus = 200;
  static triggerError = false;
  static lastInstance: MockXMLHttpRequest | null = null;

  method: string | null = null;
  url: string | null = null;
  headers: Record<string, string> = {};
  status = 0;

  upload = {
    onprogress: null as ((event: MockProgressEvent) => void) | null,
  };

  onerror: (() => void) | null = null;
  onload: (() => void) | null = null;

  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }

  setRequestHeader(key: string, value: string) {
    this.headers[key] = value;
  }

  send(file: File) {
    MockXMLHttpRequest.lastInstance = this;
    if (this.upload.onprogress) {
      this.upload.onprogress({
        lengthComputable: true,
        loaded: Math.max(1, Math.floor(file.size / 2)),
        total: Math.max(1, file.size),
      });
    }

    if (MockXMLHttpRequest.triggerError) {
      this.onerror?.();
      return;
    }

    this.status = MockXMLHttpRequest.nextStatus;
    this.onload?.();
  }
}

const withPatchedGlobals = async (
  overrides: {
    fetch?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
    xhr?: typeof XMLHttpRequest;
    localStorage?: Storage;
  },
  run: () => Promise<void>,
) => {
  const originalFetch = globalThis.fetch;
  const originalXHR = globalThis.XMLHttpRequest;
  const originalLocalStorage = (globalThis as Record<string, unknown>).localStorage;

  if (overrides.fetch) {
    (globalThis as typeof globalThis & { fetch: typeof fetch }).fetch = overrides.fetch;
  }
  if (overrides.xhr) {
    (globalThis as typeof globalThis & { XMLHttpRequest: typeof XMLHttpRequest }).XMLHttpRequest =
      overrides.xhr;
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
    if (overrides.xhr) {
      (globalThis as typeof globalThis & { XMLHttpRequest: typeof XMLHttpRequest }).XMLHttpRequest =
        originalXHR;
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

test('uploadFileWithProgress signs, uploads, and completes a file', async () => {
  const file = createTestFile();

  let signCalled = false;
  let completeCalled = false;
  const uploadUrl = 'https://storage.mock/nce-mock-uploads/uploads/test.pdf';

  await withPatchedGlobals(
    {
      fetch: async (input, init) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.endsWith('/files/sign')) {
          signCalled = true;
          return new Response(
            JSON.stringify({
              uploadUrl,
              method: 'PUT',
              headers: { 'Content-Type': file.type },
              bucket: 'nce-mock-uploads',
              objectKey: 'uploads/test.pdf',
              expiresAt: new Date().toISOString(),
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          );
        }

        if (url.endsWith('/files/complete')) {
          completeCalled = true;
          return new Response(
            JSON.stringify({
              id: 'file-123',
              bucket: 'nce-mock-uploads',
              objectKey: 'uploads/test.pdf',
              mime: file.type,
              size: file.size,
              checksum: 'checksum',
            }),
            { status: 201, headers: { 'content-type': 'application/json' } },
          );
        }

        throw new Error(`Unexpected fetch ${url}`);
      },
      xhr: MockXMLHttpRequest as unknown as typeof XMLHttpRequest,
      localStorage: createStorage(),
    },
    async () => {
      MockXMLHttpRequest.nextStatus = 200;
      MockXMLHttpRequest.triggerError = false;

      const progressValues: number[] = [];
      const result = await uploadFileWithProgress({
        file,
        onProgress: (progress) => progressValues.push(progress),
      });

      assert.equal(result.id, 'file-123');
      assert.equal(result.name, 'essay.pdf');
      assert.equal(result.bucket, 'nce-mock-uploads');
      assert.ok(signCalled);
      assert.ok(completeCalled);
      assert.ok(progressValues.some((value) => value > 0));
      assert.equal(progressValues[progressValues.length - 1], 100);

      const xhr = MockXMLHttpRequest.lastInstance;
      assert.equal(xhr?.method, 'PUT');
      assert.equal(xhr?.url, uploadUrl);
      assert.equal(xhr?.headers['Content-Type'], file.type);
    },
  );
});

test('uploadFileWithProgress surfaces upload errors', async () => {
  const file = createTestFile();

  await withPatchedGlobals(
    {
      fetch: async (input) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.endsWith('/files/sign')) {
          return new Response(
            JSON.stringify({
              uploadUrl: 'https://storage.mock/nce-mock-uploads/uploads/test.pdf',
              method: 'PUT',
              headers: { 'Content-Type': file.type },
              bucket: 'nce-mock-uploads',
              objectKey: 'uploads/test.pdf',
              expiresAt: new Date().toISOString(),
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          );
        }

        if (url.endsWith('/files/complete')) {
          return new Response(
            JSON.stringify({
              id: 'file-123',
              bucket: 'nce-mock-uploads',
              objectKey: 'uploads/test.pdf',
              mime: file.type,
              size: file.size,
              checksum: 'checksum',
            }),
            { status: 201, headers: { 'content-type': 'application/json' } },
          );
        }

        throw new Error(`Unexpected fetch ${url}`);
      },
      xhr: MockXMLHttpRequest as unknown as typeof XMLHttpRequest,
      localStorage: createStorage(),
    },
    async () => {
      MockXMLHttpRequest.triggerError = true;

      await assert.rejects(
        uploadFileWithProgress({
          file,
          onProgress: () => undefined,
        }),
        /Upload failed/,
      );
    },
  );
});

const createTestFile = (): File => {
  const payload = [new Uint8Array([1, 2, 3, 4])];
  const name = 'essay.pdf';
  const options = { type: 'application/pdf' };

  if (typeof File !== 'undefined') {
    return new File(payload, name, options);
  }

  const blob = new Blob(payload, options);
  return Object.assign(blob, { name }) as File;
};
