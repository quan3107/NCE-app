/**
 * Location: tests/aiFeedbackReviewPanel.component.test.tsx
 * Purpose: Exercise completed writing-draft teacher workflows without a provider.
 * Why: Reviewable and provisional drafts must remain editable and teacher-controlled.
 */
import assert from 'node:assert/strict';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, test, vi } from 'vitest';

import { AiFeedbackReviewPanel } from '../src/features/assignments/components/AiFeedbackReviewPanel';
import type { WritingFeedbackReviewResponse } from '../src/features/ai-feedback/types';
import { createIeltsAssignmentConfig } from '../src/lib/ielts';
import type { Assignment } from '../src/types/domain';

const draftState = vi.hoisted(() => ({
  current: null as WritingFeedbackReviewResponse | null,
}));
const regenerate = vi.hoisted(() => vi.fn());
const approve = vi.hoisted(() => vi.fn());
const finalize = vi.hoisted(() => vi.fn());
const reject = vi.hoisted(() => vi.fn());
const request = vi.hoisted(() => vi.fn());

vi.mock('@features/ai-feedback/api', () => ({
  useWritingFeedbackStatusQuery: () => ({
    data: draftState.current,
    error: null,
  }),
  useWritingFeedbackHistoryQuery: () => ({
    data: draftState.current ? [draftState.current] : [],
    error: null,
  }),
  useRequestWritingFeedbackMutation: () => ({ mutateAsync: request, isPending: false }),
  useRegenerateWritingFeedbackMutation: () => ({
    mutateAsync: regenerate,
    isPending: false,
  }),
  useApproveWritingFeedbackMutation: () => ({ mutateAsync: approve, isPending: false }),
  useFinalizeWritingFeedbackMutation: () => ({
    mutateAsync: finalize,
    isPending: false,
  }),
  useRejectWritingFeedbackMutation: () => ({ mutateAsync: reject, isPending: false }),
}));

vi.mock('sonner@2.0.3', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
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
    ...createIeltsAssignmentConfig('writing'),
    aiPolicy: {
      writingFeedbackMode: 'teacher_reviewed',
      objectiveExplanations: 'off',
      providerTier: 'premium',
    },
  },
} satisfies Assignment;

const completedDraft = {
  id: 'draft-1',
  status: 'accepted',
  visibilityMode: 'teacher_reviewed',
  feedback: { feedbackMd: 'Deterministic completed draft.' },
} satisfies WritingFeedbackReviewResponse;

beforeEach(() => {
  draftState.current = completedDraft;
  [regenerate, approve, finalize, reject, request].forEach((mock) => {
    mock.mockReset();
    mock.mockResolvedValue({});
  });
});

afterEach(() => cleanup());

test('completed reviewable drafts support edit, use, reject, regenerate, and approve', async () => {
  const onFeedbackChange = vi.fn();
  render(
    <AiFeedbackReviewPanel
      assignment={assignment}
      feedback=""
      hasExistingGrade
      onFeedbackChange={onFeedbackChange}
      submissionId="submission-1"
    />,
  );

  const editor = await screen.findByLabelText('Teacher-edited AI feedback');
  await waitFor(() =>
    assert.equal((editor as HTMLTextAreaElement).value, 'Deterministic completed draft.'),
  );
  fireEvent.change(editor, { target: { value: 'Teacher edited draft.' } });
  fireEvent.click(screen.getByRole('button', { name: /use in feedback field/i }));
  assert.deepEqual(onFeedbackChange.mock.calls.at(-1)?.[0], 'Teacher edited draft.');

  fireEvent.change(screen.getByLabelText('Rejection reason'), {
    target: { value: 'Needs a narrower claim.' },
  });
  fireEvent.click(screen.getByRole('button', { name: /^reject$/i }));
  await waitFor(() => assert.equal(reject.mock.calls.length, 1));
  assert.deepEqual(reject.mock.calls[0]?.[0], {
    draftId: 'draft-1',
    payload: { reason: 'Needs a narrower claim.' },
  });

  fireEvent.click(screen.getByRole('button', { name: /regenerate/i }));
  await waitFor(() => assert.equal(regenerate.mock.calls.length, 1));

  fireEvent.click(screen.getByRole('button', { name: /^approve$/i }));
  await waitFor(() => assert.equal(approve.mock.calls.length, 1));
  assert.deepEqual(approve.mock.calls[0]?.[0], {
    draftId: 'draft-1',
    payload: { feedbackMd: 'Teacher edited draft.' },
  });
});

test('completed instant-provisional drafts can be finalized with teacher edits', async () => {
  draftState.current = {
    ...completedDraft,
    visibilityMode: 'instant_student_visible',
  };
  const onFeedbackChange = vi.fn();
  render(
    <AiFeedbackReviewPanel
      assignment={{
        ...assignment,
        assignmentConfig: {
          ...assignment.assignmentConfig,
          aiPolicy: {
            writingFeedbackMode: 'instant_student_visible',
            objectiveExplanations: 'off',
            providerTier: 'premium',
          },
        },
      }}
      feedback=""
      hasExistingGrade
      onFeedbackChange={onFeedbackChange}
      submissionId="submission-1"
    />,
  );

  const editor = await screen.findByLabelText('Teacher-edited AI feedback');
  fireEvent.change(editor, { target: { value: 'Teacher final replacement.' } });
  fireEvent.click(screen.getByRole('button', { name: /^finalize$/i }));

  await waitFor(() => assert.equal(finalize.mock.calls.length, 1));
  assert.deepEqual(finalize.mock.calls[0]?.[0], {
    draftId: 'draft-1',
    payload: { feedbackMd: 'Teacher final replacement.' },
  });
  assert.deepEqual(onFeedbackChange.mock.calls.at(-1)?.[0], 'Teacher final replacement.');
});
