/// <reference lib="dom" />
/**
 * Location: tests/assignmentApiMappers.test.ts
 * Purpose: Validate assignment API DTO mapping behavior.
 * Why: Protects recoverable submission payloads used by student draft flows.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  toAssignment,
  toSubmission,
} from '../src/features/assignments/api.mappers';
import {
  createIeltsAssignmentConfig,
  normalizeIeltsAssignmentConfig,
} from '../src/lib/ielts';

test('toAssignment formats structured late policies for student display', () => {
  const assignment = toAssignment(
    {
      id: 'assignment-1',
      courseId: 'course-1',
      title: 'Writing W1',
      description: null,
      type: 'writing',
      dueAt: '2026-06-16T07:46:43.616Z',
      latePolicy: { type: 'percent', value: 15 },
      publishedAt: '2026-06-01T00:00:00.000Z',
      assignmentConfig: null,
    },
    'IELTS 4-Skill UIUX Sandbox',
  );

  assert.equal(assignment.latePolicy, '15% late penalty');
});

test('toAssignment maps IELTS assignments max scores to the band scale', () => {
  const buildApiAssignment = (
    type: Parameters<typeof toAssignment>[0]['type'],
  ): Parameters<typeof toAssignment>[0] => ({
    id: `${type}-assignment`,
    courseId: 'course-1',
    title: `${type} Task`,
    description: null,
    type,
    dueAt: null,
    latePolicy: null,
    publishedAt: '2026-06-01T00:00:00.000Z',
    assignmentConfig: null,
  });

  const reading = toAssignment(buildApiAssignment('reading'), 'IELTS');
  const listening = toAssignment(buildApiAssignment('listening'), 'IELTS');
  const writing = toAssignment(
    buildApiAssignment('writing'),
    'IELTS',
  );
  const speaking = toAssignment(
    buildApiAssignment('speaking'),
    'IELTS',
  );

  assert.equal(reading.maxScore, 9);
  assert.equal(listening.maxScore, 9);
  assert.equal(writing.maxScore, 9);
  assert.equal(speaking.maxScore, 9);
});

test('toAssignment keeps non-IELTS assignment max scores on the generic point scale', () => {
  const assignment = toAssignment(
    {
      id: 'file-assignment',
      courseId: 'course-1',
      title: 'Generic File Upload',
      description: null,
      type: 'file',
      dueAt: null,
      latePolicy: null,
      publishedAt: '2026-06-01T00:00:00.000Z',
      assignmentConfig: null,
    },
    'General Course',
  );

  assert.equal(assignment.maxScore, 100);
});

test('IELTS assignment configs default AI policy to off', () => {
  const assignmentConfig = createIeltsAssignmentConfig('writing');

  assert.deepEqual(assignmentConfig.aiPolicy, {
    writingFeedbackMode: 'off',
    objectiveExplanations: 'off',
    providerTier: 'auto',
  });
});

test('normalizeIeltsAssignmentConfig preserves assignment AI policy', () => {
  const assignmentConfig = normalizeIeltsAssignmentConfig('reading', {
    version: 1,
    sections: [],
    aiPolicy: {
      writingFeedbackMode: 'off',
      objectiveExplanations: 'on_demand_student_visible',
      providerTier: 'low_cost',
    },
  });

  assert.deepEqual(assignmentConfig.aiPolicy, {
    writingFeedbackMode: 'off',
    objectiveExplanations: 'on_demand_student_visible',
    providerTier: 'low_cost',
  });
});

test('toSubmission preserves the raw payload for draft recovery', () => {
  const payload = {
    version: 2,
    startedAt: '2026-02-01T10:00:00.000Z',
    answers: [{ questionId: 'q-1', value: 'B' }],
  };

  const submission = toSubmission({
    id: 'submission-1',
    assignmentId: 'assignment-1',
    studentId: 'student-1',
    status: 'draft',
    submittedAt: null,
    payload,
  });

  assert.deepEqual(submission.rawPayload, payload);
});

test('toSubmission maps IELTS speaking recordings to downloadable files', () => {
  const submission = toSubmission({
    id: 'submission-1',
    assignmentId: 'assignment-1',
    studentId: 'student-1',
    status: 'submitted',
    submittedAt: '2026-02-01T10:00:00.000Z',
    payload: {
      version: 1,
      recordings: [
        {
          part: 'part1',
          fileId: 'recording-file-1',
          fileName: 'speaking-part-1.webm',
          durationSeconds: 42,
        },
      ],
    },
  });

  assert.deepEqual(submission.files, [
    {
      id: 'recording-file-1',
      name: 'speaking-part-1.webm',
      size: 0,
      mime: 'application/octet-stream',
      checksum: '',
      bucket: '',
      objectKey: '',
    },
  ]);
});
