/**
 * Location: tests/speakingConcurrentUploads.component.test.tsx
 * Purpose: Exercise real uploader callbacks across concurrent speaking parts.
 * Why: Deferred completions must preserve sibling recordings and duration edits.
 */
import React, { useState } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { StudentIeltsSpeakingAttempt } from '../src/features/assignments/components/ielts/student/StudentIeltsSpeakingAttempt';
import { createInitialStudentIeltsAttempt } from '../src/features/assignments/components/ielts/student/studentIeltsAttempt.logic';
import type { IeltsSpeakingConfig } from '../src/lib/ielts';

const mocks = vi.hoisted(() => ({ upload: vi.fn() }));
vi.mock('@features/files/configApi', () => ({ useFileUploadConfig: () => ({
  data: { limits: { maxFileSize: 1024, maxTotalSize: 4096, maxFilesPerUpload: 5 },
    accept: 'audio/*', typeLabel: 'Audio', allowedMimeTypes: new Set(['audio/wav']),
    allowedExtensions: new Set(['.wav']), allowedTypes: [] }, isLoading: false,
}) }));
vi.mock('@features/files/fileUpload', () => ({ isAllowedFile: () => ({ ok: true }), uploadFileWithProgress: mocks.upload }));
afterEach(cleanup);

test('concurrent completions preserve all parts and intervening duration edits', async () => {
  const finishes: ((file: unknown) => void)[] = [];
  mocks.upload.mockImplementation(() => new Promise(resolve => finishes.push(resolve)));
  const config = { part1: { questions: ['One?'] }, part2: { cueCard: { topic: 'Two', bulletPoints: [] } }, part3: { questions: ['Three?'] } } as IeltsSpeakingConfig;
  function Harness() {
    const [attempt, setAttempt] = useState(createInitialStudentIeltsAttempt());
    return <><StudentIeltsSpeakingAttempt config={config} attempt={attempt} onChange={setAttempt} />
      <output data-testid="state">{JSON.stringify(attempt.speakingRecordings)}</output></>;
  }
  const { container } = render(<Harness />);
  const inputs = container.querySelectorAll('input[type="file"]');
  inputs.forEach((input, i) => fireEvent.change(input, { target: { files: [new File(['wav'], `part${i + 1}.wav`, { type: 'audio/wav' })] } }));
  fireEvent.change(screen.getAllByRole('spinbutton')[0], { target: { value: '17' } });
  await act(async () => {
    finishes.forEach((finish, i) => finish({ id: `file-${i + 1}`, name: `part${i + 1}.wav`, size: 3, mime: 'audio/wav' }));
  });
  const recordings = JSON.parse(screen.getByTestId('state').textContent!);
  expect(Object.keys(recordings).sort()).toEqual(['part1', 'part2', 'part3']);
  expect(recordings.part1.durationSeconds).toBe(17);
  expect(recordings.part2.id).toBe('file-2');
  expect(recordings.part3.id).toBe('file-3');
});
