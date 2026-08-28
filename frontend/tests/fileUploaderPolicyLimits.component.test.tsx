/**
 * Location: tests/fileUploaderPolicyLimits.component.test.tsx
 * Purpose: Verify the uploader enforces the configured maximum file count.
 * Why: Client feedback should match the server policy before uploads are attempted.
 */
import assert from 'node:assert/strict';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  toastError: vi.fn(),
  uploadFileWithProgress: vi.fn(),
  maxFilesPerUpload: 1,
}));

vi.mock('@features/files/configApi', () => ({
  useFileUploadConfig: () => ({
    data: {
      limits: {
        maxFileSize: 1_024,
        maxTotalSize: 2_048,
        maxFilesPerUpload: mocks.maxFilesPerUpload,
      },
      allowedTypes: [],
      accept: '.pdf',
      typeLabel: 'PDF files',
      allowedMimeTypes: new Set(['application/pdf']),
      allowedExtensions: new Set(['.pdf']),
    },
    isLoading: false,
    error: null,
  }),
}));

vi.mock('@features/files/fileUpload', () => ({
  isAllowedFile: () => ({ ok: true }),
  uploadFileWithProgress: mocks.uploadFileWithProgress,
}));

vi.mock('sonner@2.0.3', () => ({
  toast: { error: mocks.toastError },
}));

import { FileUploader } from '../src/components/common/FileUploader';

beforeEach(() => {
  mocks.maxFilesPerUpload = 1;
  mocks.toastError.mockReset();
  mocks.uploadFileWithProgress.mockReset();
});

afterEach(() => {
  cleanup();
});

test('FileUploader attempts no more than the configured maximum file count', async () => {
  mocks.uploadFileWithProgress.mockResolvedValue({
    id: 'file-1',
    name: 'first.pdf',
    size: 100,
    mime: 'application/pdf',
    checksum: 'checksum',
    bucket: 'nce-mock-uploads',
    objectKey: 'uploads/student/first.pdf',
  });
  const { container } = render(<FileUploader value={[]} onChange={vi.fn()} />);
  const input = container.querySelector('input[type="file"]');
  assert.ok(input);

  fireEvent.change(input, {
    target: {
      files: [
        new File(['first'], 'first.pdf', { type: 'application/pdf' }),
        new File(['second'], 'second.pdf', { type: 'application/pdf' }),
      ],
    },
  });

  await waitFor(() => assert.equal(mocks.uploadFileWithProgress.mock.calls.length, 1));
  assert.equal(mocks.toastError.mock.calls[0]?.[0], 'You can upload up to 1 file.');
});

test('FileUploader preserves every successful parallel upload', async () => {
  mocks.maxFilesPerUpload = 3;
  mocks.uploadFileWithProgress.mockImplementation(async ({ file }: { file: File }) => ({
    id: `file-${file.name}`,
    name: file.name,
    size: file.size,
    mime: file.type,
    checksum: `checksum-${file.name}`,
    bucket: 'nce-mock-uploads',
    objectKey: `uploads/student/${file.name}`,
  }));
  const onChange = vi.fn();
  const { container } = render(<FileUploader value={[]} onChange={onChange} />);
  const input = container.querySelector('input[type="file"]');
  assert.ok(input);

  fireEvent.change(input, {
    target: {
      files: [
        new File(['first'], 'first.pdf', { type: 'application/pdf' }),
        new File(['second'], 'second.pdf', { type: 'application/pdf' }),
      ],
    },
  });

  await waitFor(() => {
    const latestFiles = onChange.mock.calls.at(-1)?.[0];
    assert.equal(latestFiles?.length, 2);
  });
  assert.deepEqual(
    onChange.mock.calls.at(-1)?.[0].map((file: { name: string }) => file.name),
    ['first.pdf', 'second.pdf'],
  );
});
