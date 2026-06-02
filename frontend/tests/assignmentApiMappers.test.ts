/// <reference lib="dom" />
/**
 * Location: tests/assignmentApiMappers.test.ts
 * Purpose: Validate assignment API DTO mapping behavior.
 * Why: Protects recoverable submission payloads used by student draft flows.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { toAssignment, toSubmission } from '../src/features/assignments/api.mappers';

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
