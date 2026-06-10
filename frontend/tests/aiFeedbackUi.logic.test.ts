import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  buildAiFeedbackPolicyView,
  buildWritingFeedbackDecisionActionView,
  buildWritingFeedbackDraftView,
  extractEditableFeedback,
  normalizeAiPolicyForAssignmentType,
  syncWritingFeedbackPendingDecisionFeedback,
} from '../src/features/ai-feedback/ui.logic';
import type { WritingFeedbackReviewResponse } from '../src/features/ai-feedback/types';
import { createIeltsAssignmentConfig } from '../src/lib/ielts';

test('normalizeAiPolicyForAssignmentType disables writing feedback outside writing assignments', () => {
  const policy = normalizeAiPolicyForAssignmentType('reading', {
    writingFeedbackMode: 'teacher_reviewed',
    objectiveExplanations: 'on_demand_student_visible',
    providerTier: 'premium',
  });

  assert.deepEqual(policy, {
    writingFeedbackMode: 'off',
    objectiveExplanations: 'on_demand_student_visible',
    providerTier: 'premium',
  });
});

test('normalizeAiPolicyForAssignmentType disables objective explanations for non-objective skills', () => {
  const policy = normalizeAiPolicyForAssignmentType('writing', {
    writingFeedbackMode: 'instant_student_visible',
    objectiveExplanations: 'on_demand_student_visible',
    providerTier: 'low_cost',
  });

  assert.deepEqual(policy, {
    writingFeedbackMode: 'instant_student_visible',
    objectiveExplanations: 'off',
    providerTier: 'low_cost',
  });
});

test('buildAiFeedbackPolicyView explains visual Task 1 image availability', () => {
  const config = createIeltsAssignmentConfig('writing');
  const visualConfig = {
    ...config,
    task1: {
      ...config.task1,
      visualType: 'line_graph',
    },
  };
  const withoutImage = buildAiFeedbackPolicyView('writing', visualConfig);
  const withImage = buildAiFeedbackPolicyView('writing', {
    ...visualConfig,
    task1: {
      ...visualConfig.task1,
      imageFileId: 'file-1',
    },
  });

  assert.equal(withoutImage.imageContext.status, 'missing-image');
  assert.match(withoutImage.imageContext.message, /image context is unavailable/i);
  assert.equal(withImage.imageContext.status, 'available');
  assert.match(withImage.imageContext.message, /image can be sent/i);
});

test('extractEditableFeedback formats provider output for teacher review', () => {
  const text = extractEditableFeedback({
    band_estimate: 6.5,
    rationale: 'The response is understandable.',
    strengths: ['Clear position in Task 2'],
    improvement_areas: ['Use more precise visual comparisons'],
    next_steps: ['Add one quantified comparison'],
  });

  assert.match(text, /Band estimate: 6.5/);
  assert.match(text, /The response is understandable/);
  assert.match(text, /Strengths/);
  assert.match(text, /Next steps/);
});

test('buildWritingFeedbackDraftView distinguishes active, reviewable, finalized, and image failures', () => {
  const active = buildWritingFeedbackDraftView({
    id: 'draft-1',
    status: 'queued',
    visibilityMode: 'teacher_reviewed',
  } as WritingFeedbackReviewResponse);
  const reviewable = buildWritingFeedbackDraftView({
    id: 'draft-2',
    status: 'accepted',
    visibilityMode: 'teacher_reviewed',
    feedback: { rationale: 'Ready for review.' },
  } as WritingFeedbackReviewResponse);
  const finalized = buildWritingFeedbackDraftView({
    id: 'draft-3',
    status: 'finalized',
    visibilityMode: 'instant_student_visible',
    decision: 'finalized',
  } as WritingFeedbackReviewResponse);
  const imageUnavailable = buildWritingFeedbackDraftView({
    id: 'draft-4',
    status: 'review_required',
    visibilityMode: 'teacher_reviewed',
    failureCode: 'image_context_unavailable',
    failureMessage: 'Task 1 is visual, but no image file is attached.',
  } as WritingFeedbackReviewResponse);

  assert.equal(active.canDecide, false);
  assert.equal(active.tone, 'info');
  assert.equal(reviewable.canDecide, true);
  assert.match(reviewable.description, /Teacher-reviewed/);
  assert.equal(finalized.canDecide, false);
  assert.match(finalized.label, /Finalized/);
  assert.equal(imageUnavailable.tone, 'warning');
  assert.match(imageUnavailable.description, /image file is attached/);
});

test('buildWritingFeedbackDecisionActionView defers decisions until a grade exists', () => {
  const approveWithoutGrade = buildWritingFeedbackDecisionActionView('approve', false);
  const finalizeWithoutGrade = buildWritingFeedbackDecisionActionView('finalize', false);
  const approveWithGrade = buildWritingFeedbackDecisionActionView('approve', true);

  assert.equal(approveWithoutGrade.mode, 'after-grade-post');
  assert.equal(approveWithoutGrade.label, 'Approve after posting grade');
  assert.match(approveWithoutGrade.description, /Post Grade creates the grade/i);
  assert.equal(finalizeWithoutGrade.label, 'Finalize after posting grade');
  assert.equal(approveWithGrade.mode, 'immediate');
  assert.equal(approveWithGrade.label, 'Approve');
});

test('syncWritingFeedbackPendingDecisionFeedback refreshes queued decision text for the same draft', () => {
  const pendingDecision = {
    action: 'approve' as const,
    draftId: 'draft-1',
    feedbackMd: 'Original feedback.',
  };

  const updated = syncWritingFeedbackPendingDecisionFeedback(
    pendingDecision,
    'draft-1',
    '  Updated feedback after queueing.  ',
  );
  const unchanged = syncWritingFeedbackPendingDecisionFeedback(
    pendingDecision,
    'draft-2',
    'Different draft feedback.',
  );

  assert.deepEqual(updated, {
    action: 'approve',
    draftId: 'draft-1',
    feedbackMd: 'Updated feedback after queueing.',
  });
  assert.equal(unchanged, pendingDecision);
});
