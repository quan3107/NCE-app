/// <reference lib="dom" />
/**
 * Location: tests/studentIeltsAttempt.uiSource.test.ts
 * Purpose: Guard student IELTS UI source contracts that are hard to render in node:test.
 * Why: Prevents instructor-only listening transcripts and backend file IDs from leaking to students.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { getRecordingFileForUpload } from '../src/features/assignments/components/ielts/student/StudentIeltsSpeakingAttempt';

const attemptFormSource = readFileSync(
  'src/features/assignments/components/ielts/student/StudentIeltsAttemptForm.tsx',
  'utf8',
);
const speakingSource = readFileSync(
  'src/features/assignments/components/ielts/student/StudentIeltsSpeakingAttempt.tsx',
  'utf8',
);

test('student listening attempt renders audio controls without transcript disclosure', () => {
  assert.doesNotMatch(attemptFormSource, /Transcript/);
  assert.match(attemptFormSource, /<audio\b/);
  assert.match(attemptFormSource, /apiClient<FileContentLocation>/);
  assert.doesNotMatch(attemptFormSource, /API_BASE_URL/);
});

test('student speaking attempt uses upload UI instead of raw file id entry', () => {
  assert.doesNotMatch(speakingSource, /Recording file ID/);
  assert.match(speakingSource, /FileUploader/);
});

test('student speaking attempt does not show a completed upload for duration-only recordings', () => {
  assert.equal(getRecordingFileForUpload({ id: '', durationSeconds: 30 }), null);
});
