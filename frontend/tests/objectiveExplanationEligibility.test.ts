/**
 * Location: tests/objectiveExplanationEligibility.test.ts
 * Purpose: Verify student objective explanation actions require structured answers.
 * Why: Legacy file-only submissions must not expose an action that cannot be fulfilled.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { getEligibleObjectiveExplanationTargets } from '../src/features/grades/objectiveExplanationEligibility';
import type { Assignment, Submission } from '../src/types/domain';

const assignment = {
  id: 'assignment-1',
  title: 'Reading practice',
  description: '',
  type: 'reading',
  courseId: 'course-1',
  courseName: 'Reading',
  dueAt: new Date('2026-08-16T00:00:00.000Z'),
  status: 'published',
  latePolicy: 'none',
  maxScore: 9,
  assignmentConfig: {
    version: 1,
    aiPolicy: {
      writingFeedbackMode: 'off',
      objectiveExplanations: 'on_demand_student_visible',
      providerTier: 'auto',
    },
    sections: [
      {
        id: 'section-1',
        title: 'Passage',
        passage: 'A source-backed passage.',
        questions: [
          { id: 'q1', type: 'short_answer', prompt: 'First question?', answer: 'one' },
          { id: 'q2', type: 'short_answer', prompt: 'Second question?', answer: 'two' },
        ],
      },
    ],
  },
} satisfies Assignment;

const submission = {
  id: 'submission-1',
  assignmentId: assignment.id,
  studentId: 'student-1',
  studentName: 'Student',
  status: 'graded',
  version: 1,
  rawPayload: {
    version: 1,
    answers: [{ questionId: 'q2', value: 'student-private-answer' }],
  },
} satisfies Submission;

test('returns only targets backed by a structured submitted answer', () => {
  assert.deepEqual(
    getEligibleObjectiveExplanationTargets(assignment, submission).map(
      (target) => target.id,
    ),
    ['q2'],
  );
});

test('returns no targets for malformed legacy file-only payloads', () => {
  const legacySubmission: Submission = {
    ...submission,
    rawPayload: { version: 1, files: [{ id: 'file-1', name: 'answers.pdf' }] },
  };

  assert.deepEqual(
    getEligibleObjectiveExplanationTargets(assignment, legacySubmission),
    [],
  );
});
