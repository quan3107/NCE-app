/**
 * Location: tests/fileUploader.component.test.tsx
 * Purpose: Verify upload policy error behavior in FileUploader.
 * Why: Existing selected files must remain visible and removable when new uploads fail closed.
 */
import assert from 'node:assert/strict';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, test, vi } from 'vitest';

import { FileUploader } from '../src/components/common/FileUploader';
import type { SubmissionFile } from '../src/types/domain/files';

vi.mock('@features/files/configApi', () => ({
  useFileUploadConfig: () => ({
    data: undefined,
    isLoading: false,
    error: new Error('Upload policy unavailable'),
  }),
}));

vi.mock('sonner@2.0.3', () => ({
  toast: {
    error: vi.fn(),
  },
}));

afterEach(() => {
  cleanup();
});

test('upload policy error keeps existing files visible and removable', () => {
  const existingFile: SubmissionFile = {
    id: 'file-1',
    name: 'essay.pdf',
    size: 1024,
    mime: 'application/pdf',
  };
  const onChange = vi.fn();

  render(<FileUploader value={[existingFile]} onChange={onChange} />);

  assert.ok(screen.getByText('Unable to load upload policy.'));
  assert.ok(screen.getByText('essay.pdf'));

  fireEvent.click(screen.getByRole('button', { name: /remove essay\.pdf/i }));

  assert.deepEqual(onChange.mock.calls[0]?.[0], []);
});
