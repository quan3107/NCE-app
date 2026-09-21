/**
 * Location: tests/listeningAudioValidation.component.test.tsx
 * Purpose: Exercise listening file selection through the rendered authoring form.
 * Why: Invalid selections must never replace audio or reach the save upload queue.
 */
import React, { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { ListeningAssignmentForm } from '../src/features/assignments/components/ielts/authoring/ListeningAssignmentForm';
import { createFileUploadPolicy } from '../src/features/files/uploadPolicy';
import type { IeltsListeningConfig } from '../src/lib/ielts';
import { createIeltsAssignmentConfig } from '../src/lib/ielts';

const mocks = vi.hoisted(() => ({ policy: undefined as unknown, createUrl: vi.fn(), revokeUrl: vi.fn() }));
vi.mock('@features/files/configApi', () => ({ useFileUploadConfig: () => ({ data: mocks.policy }) }));
vi.mock('@features/ielts-config/api', () => ({
  useEnabledListeningQuestionTypes: () => ({ data: [] }),
  useEnabledCompletionFormats: () => ({ data: [] }),
}));
vi.mock('@features/ielts-config/questionOptions.api', () => ({
  useBooleanQuestionOptions: () => ({ trueFalseOptions: [], yesNoOptions: [] }),
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

test('student preview plays selected audio and hides private content without losing edits', () => {
  const value = createIeltsAssignmentConfig('listening') as IeltsListeningConfig;
  value.sections = [{ ...value.sections[0], transcript: 'Private transcript', questions: [{
    id: 'q1', type: 'multiple_choice', prompt: 'Pick a tone', options: ['Low', 'High'], correctAnswer: '1',
  }] }];
  function Harness() {
    const [preview, setPreview] = useState(false);
    return <><button onClick={() => setPreview(!preview)}>Toggle preview</button>
      <ListeningAssignmentForm value={value} onChange={vi.fn()} onAudioSelect={vi.fn()} showPreview={preview} /></>;
  }
  const view = render(<Harness />);
  fireEvent.change(view.container.querySelector('input[type="file"]:not([multiple])')!, {
    target: { files: [new File(['wav'], 'one.wav', { type: 'audio/wav' })] },
  });
  fireEvent.click(screen.getByText('Toggle preview'));
  expect(screen.getByText('Student preview')).toBeTruthy();
  expect(screen.getByText('1. Pick a tone')).toBeTruthy();
  expect(screen.queryByText('Private transcript')).toBeNull();
  expect(screen.queryByText('Correct Answer')).toBeNull();
  expect(view.container.querySelector('audio')?.getAttribute('src')).toBe('blob:audio');
  fireEvent.click(screen.getAllByRole('radio')[1]);
  fireEvent.click(screen.getByText('Toggle preview'));
  expect(screen.getByText('one.wav')).toBeTruthy();
  expect((screen.getByLabelText('Transcript (instructor-only)') as HTMLTextAreaElement).value).toBe('Private transcript');
});

test('removing a section drops its audio queue and keeps sibling content', () => {
  const onAudioSelect = vi.fn();
  function Harness() {
    const [value, onChange] = useState(createIeltsAssignmentConfig('listening') as IeltsListeningConfig);
    return <ListeningAssignmentForm value={value} onChange={onChange} onAudioSelect={onAudioSelect} />;
  }
  const view = render(<Harness />);
  fireEvent.change(view.container.querySelector('input[type="file"]:not([multiple])')!, {
    target: { files: [new File(['wav'], 'one.wav', { type: 'audio/wav' })] },
  });
  const sectionId = onAudioSelect.mock.calls[0][0];
  fireEvent.click(screen.getByRole('button', { name: 'Remove Section 1', exact: true }));
  expect(onAudioSelect).toHaveBeenLastCalledWith(sectionId, null);
  expect(screen.queryByRole('heading', { name: 'Section 1', exact: true })).toBeNull();
  expect(screen.getByRole('heading', { name: 'Section 2', exact: true })).toBeTruthy();
  expect(mocks.revokeUrl).toHaveBeenCalledWith('blob:audio');
});
