/**
 * Location: tests/listeningAudioValidation.component.test.tsx
 * Purpose: Exercise listening file selection through the rendered authoring form.
 * Why: Invalid selections must never replace audio or reach the save upload queue.
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { ListeningAssignmentForm } from '../src/features/assignments/components/ielts/authoring/ListeningAssignmentForm';
import { createFileUploadPolicy } from '../src/features/files/uploadPolicy';
import type { IeltsListeningConfig } from '../src/lib/ielts';

const mocks = vi.hoisted(() => ({ policy: undefined as unknown, createUrl: vi.fn(), revokeUrl: vi.fn() }));
vi.mock('@features/files/configApi', () => ({ useFileUploadConfig: () => ({ data: mocks.policy }) }));
vi.mock('@features/ielts-config/api', () => ({
  useEnabledListeningQuestionTypes: () => ({ data: [] }),
  useEnabledCompletionFormats: () => ({ data: [] }),
}));
vi.mock('@components/ui/audio-player', () => ({ AudioPlayer: ({ fileName }: { fileName: string }) => <output>{fileName}</output> }));

beforeEach(() => {
  mocks.policy = createFileUploadPolicy({
    limits: { maxFileSize: 100, maxTotalSize: 500, maxFilesPerUpload: 5 },
    allowedTypes: [
      { mimeType: 'audio/*', extensions: ['.wav', '.mp3'], label: 'Audio', acceptToken: 'audio/*' },
      { mimeType: 'text/plain', extensions: ['.txt'], label: 'Text', acceptToken: '.txt' },
    ],
  });
  mocks.createUrl.mockReset().mockReturnValue('blob:audio');
  mocks.revokeUrl.mockReset();
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: mocks.createUrl, revokeObjectURL: mocks.revokeUrl }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function setup() {
  const onAudioSelect = vi.fn();
  const value = { sections: [{ id: 'one', title: 'Section 1', audioFileId: null, questions: [], playback: { limitPlays: 1 } }] } as IeltsListeningConfig;
  const result = render(<ListeningAssignmentForm value={value} onChange={vi.fn()} onAudioSelect={onAudioSelect} />);
  const select = (files: File[], bulk = false) => fireEvent.change(result.container.querySelector(`input[type="file"]${bulk ? '[multiple]' : ':not([multiple])'}`)!, { target: { files } });
  return { ...result, onAudioSelect, select };
}

test('rejects text repeatedly before preview or upload and preserves existing valid audio', () => {
  const { select, onAudioSelect } = setup();
  const text = new File(['bad'], 'upload.txt', { type: 'text/plain' });
  select([text]); select([text]);
  expect(screen.getByRole('alert').textContent).toContain('Unsupported file type: upload.txt');
  expect(mocks.createUrl).not.toHaveBeenCalled();
  expect(onAudioSelect).not.toHaveBeenCalled();
  const wav = new File(['audio'], 'section1.wav', { type: 'audio/wav' });
  select([wav]);
  expect(onAudioSelect).toHaveBeenLastCalledWith('one', wav);
  expect(screen.queryByRole('alert')).toBeNull();
  select([text]);
  expect(screen.getByText('section1.wav')).toBeTruthy();
  expect(mocks.revokeUrl).not.toHaveBeenCalled();
  expect(onAudioSelect).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Remove', exact: true }));
  expect(onAudioSelect).toHaveBeenLastCalledWith('one', null);
});

test('rejects mixed bulk input explicitly and accepts a corrected audio-only selection', () => {
  const { select, onAudioSelect } = setup();
  const wav = new File(['audio'], 'section1.wav', { type: 'audio/wav' });
  select([wav, new File(['bad'], 'upload.txt', { type: 'text/plain' })], true);
  expect(screen.getByRole('alert').textContent).toContain('upload.txt');
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(onAudioSelect).not.toHaveBeenCalled();
  select([wav], true);
  expect(screen.getByRole('dialog')).toBeTruthy();
  expect(screen.queryByRole('alert')).toBeNull();
});

test('fails closed without upload policy', () => {
  mocks.policy = undefined;
  const { select, onAudioSelect } = setup();
  select([new File(['a'], 'one.wav', { type: 'audio/wav' })]);
  expect(screen.getByRole('alert').textContent).toContain('Upload policy is unavailable');
  expect(onAudioSelect).not.toHaveBeenCalled();
});

test('supports extension fallback and rejects oversized files before preview', () => {
  const { select, onAudioSelect } = setup();
  select([new File(['x'.repeat(101)], 'large.wav', { type: 'audio/wav' })]);
  expect(screen.getByRole('alert').textContent).toContain('exceeds');
  expect(mocks.createUrl).not.toHaveBeenCalled();
  const wav = new File(['audio'], 'SECTION.WAV');
  select([wav]);
  expect(onAudioSelect).toHaveBeenLastCalledWith('one', wav);
});
