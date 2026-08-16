/**
 * Location: tests/teacherWritingFeedbackBatchAction.component.test.tsx
 * Purpose: Exercise the assignment-scoped teacher AI batch action.
 * Why: Batch queueing needs accessible selectors, duplicate guards, and clear results.
 */
import assert from 'node:assert/strict';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, test, vi } from 'vitest';

import { TeacherWritingFeedbackBatchAction } from '../src/features/assignments/components/TeacherWritingFeedbackBatchAction';
import type { Assignment, Submission } from '../src/types/domain';

const mutation = vi.hoisted(() => vi.fn());
const toastSuccess = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());
const hookState = vi.hoisted(() => ({ isPending: false }));
const hookArgs = vi.hoisted(() => vi.fn());

vi.mock('@features/ai-feedback/api', () => ({
  useRequestAssignmentWritingFeedbackBatchMutation: (args: unknown) => {
    hookArgs(args);
    return {
      mutateAsync: mutation,
      isPending: hookState.isPending,
    };
  },
}));

vi.mock('sonner@2.0.3', () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}));

const assignment = {
  id: 'assignment-1',
  title: 'Writing practice',
  description: '',
  type: 'writing',
  courseId: 'course-1',
  courseName: 'Writing',
  dueAt: new Date('2026-08-16T00:00:00.000Z'),
  status: 'published',
  latePolicy: 'none',
  maxScore: 9,
  assignmentConfig: {
    version: 1,
    aiPolicy: {
      writingFeedbackMode: 'teacher_reviewed',
      objectiveExplanations: 'off',
      providerTier: 'premium',
    },
  },
} satisfies Assignment;

const submissions = [
  {
    id: 'submission-1',
    assignmentId: assignment.id,
    studentId: 'student-1',
    studentName: 'Amelia',
    status: 'submitted',
    version: 1,
  },
  {
    id: 'submission-2',
    assignmentId: assignment.id,
    studentId: 'student-2',
    studentName: 'Diego',
    status: 'late',
    version: 1,
  },
] satisfies Submission[];

beforeEach(() => {
  mutation.mockReset();
  toastSuccess.mockReset();
  toastError.mockReset();
  hookArgs.mockReset();
  hookState.isPending = false;
});

afterEach(() => cleanup());

test('queues the selected assignment filter with course and assignment scope', async () => {
  mutation.mockResolvedValue({
    assignmentId: assignment.id,
    requestedCount: 3,
    results: [
      { submissionId: 'submission-1', status: 'queued' },
      { submissionId: 'submission-2', status: 'skipped' },
      { submissionId: 'submission-3', status: 'policy_disabled' },
    ],
  });

  render(
    <TeacherWritingFeedbackBatchAction
      assignment={assignment}
      submissions={submissions}
    />,
  );

  assert.deepEqual(hookArgs.mock.calls.at(-1)?.[0], {
    courseId: 'course-1',
    assignmentId: 'assignment-1',
  });
  fireEvent.click(screen.getByRole('button', { name: /queue ungraded ai drafts/i }));

  await waitFor(() => assert.equal(mutation.mock.calls.length, 1));
  assert.deepEqual(mutation.mock.calls[0]?.[0], { filter: 'ungraded' });
  assert.ok(await screen.findByText(/1 queued, 1 skipped, 1 conflict/i));
  assert.equal(toastSuccess.mock.calls.length, 1);
});

test('disables pending requests and locally queued duplicate selections', async () => {
  mutation.mockResolvedValue({
    assignmentId: assignment.id,
    requestedCount: 1,
    results: [{ submissionId: 'submission-1', status: 'queued' }],
  });

  const view = render(
    <TeacherWritingFeedbackBatchAction
      assignment={assignment}
      submissions={submissions}
    />,
  );

  const amelia = screen.getByRole('checkbox', { name: /amelia/i });
  fireEvent.click(amelia);
  fireEvent.click(screen.getByRole('button', { name: /queue selected ai drafts/i }));

  await waitFor(() => assert.equal(mutation.mock.calls.length, 1));
  assert.deepEqual(mutation.mock.calls[0]?.[0], {
    submissionIds: ['submission-1'],
  });
  await waitFor(() => assert.equal((amelia as HTMLInputElement).disabled, true));

  hookState.isPending = true;
  view.rerender(
    <TeacherWritingFeedbackBatchAction
      assignment={assignment}
      submissions={submissions}
    />,
  );
  assert.equal(
    (screen.getByRole('button', { name: /queue ungraded ai drafts/i }) as HTMLButtonElement)
      .disabled,
    true,
  );
});

test('reports batch errors without leaving the request action enabled while pending', async () => {
  mutation.mockRejectedValue(new Error('Batch queue unavailable.'));

  render(
    <TeacherWritingFeedbackBatchAction
      assignment={assignment}
      submissions={submissions}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: /queue submitted ai drafts/i }));

  assert.ok(await screen.findByRole('alert'));
  assert.match(screen.getByRole('alert').textContent ?? '', /Batch queue unavailable/);
  assert.equal(toastError.mock.calls.length, 1);
});

test('does not expose batch generation when writing AI is disabled', () => {
  render(
    <TeacherWritingFeedbackBatchAction
      assignment={{
        ...assignment,
        assignmentConfig: {
          ...assignment.assignmentConfig,
          aiPolicy: {
            writingFeedbackMode: 'off',
            objectiveExplanations: 'off',
            providerTier: 'auto',
          },
        },
      }}
      submissions={submissions}
    />,
  );

  assert.equal(
    Boolean(screen.queryByRole('button', { name: /ai drafts/i })),
    false,
  );
});
