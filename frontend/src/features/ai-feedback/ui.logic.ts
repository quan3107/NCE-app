/**
 * Location: features/ai-feedback/ui.logic.ts
 * Purpose: Keep AI feedback policy and review presentation decisions testable.
 * Why: Teacher-facing copy and enabled states are shared across authoring and grading UI.
 */

import type {
  IeltsAiProviderTier,
  IeltsAssignmentAiPolicy,
  IeltsAssignmentConfig,
  IeltsAssignmentType,
  IeltsWritingFeedbackMode,
  IeltsWritingConfig,
} from '@lib/ielts';
import type { WritingFeedbackReviewResponse } from './types';

type PolicyAvailability = {
  writingFeedbackSupported: boolean;
  objectiveExplanationsSupported: boolean;
};

export type PolicyImageContextView = {
  status: 'not-visual-writing' | 'missing-image' | 'available';
  message: string;
};

export type AiFeedbackPolicyView = PolicyAvailability & {
  policy: IeltsAssignmentAiPolicy;
  imageContext: PolicyImageContextView;
  providerTierLabel: string;
  writingFeedbackLabel: string;
};

export type WritingFeedbackDraftTone = 'info' | 'success' | 'warning' | 'destructive' | 'muted';

export type WritingFeedbackDraftView = {
  label: string;
  description: string;
  canDecide: boolean;
  canRegenerate: boolean;
  canFinalize: boolean;
  tone: WritingFeedbackDraftTone;
};

export type WritingFeedbackDecisionAction = 'approve' | 'finalize';

export type WritingFeedbackDecisionActionView = {
  label: string;
  description: string;
  mode: 'immediate' | 'after-grade-post';
};

export type WritingFeedbackPendingDecision = {
  action: WritingFeedbackDecisionAction;
  draftId: string;
  feedbackMd: string;
};

const objectiveTypes = new Set<IeltsAssignmentType>(['reading', 'listening']);

const writingFeedbackLabels: Record<IeltsWritingFeedbackMode, string> = {
  off: 'Off',
  teacher_reviewed: 'Teacher-reviewed',
  instant_student_visible: 'Instant provisional',
};

const providerTierLabels: Record<IeltsAiProviderTier, string> = {
  auto: 'Auto route',
  low_cost: 'Low-cost route',
  premium: 'Premium route',
};

export function normalizeAiPolicyForAssignmentType(
  type: IeltsAssignmentType,
  policy: IeltsAssignmentAiPolicy,
): IeltsAssignmentAiPolicy {
  return {
    writingFeedbackMode: type === 'writing' ? policy.writingFeedbackMode : 'off',
    objectiveExplanations: objectiveTypes.has(type) ? policy.objectiveExplanations : 'off',
    providerTier: policy.providerTier,
  };
}

function isVisualWritingTask1(config: IeltsAssignmentConfig): config is IeltsWritingConfig {
  if (!('task1' in config)) {
    return false;
  }

  return Boolean(config.task1.visualType || config.task1.imageFileId);
}

export function getPolicyAvailability(type: IeltsAssignmentType): PolicyAvailability {
  return {
    writingFeedbackSupported: type === 'writing',
    objectiveExplanationsSupported: objectiveTypes.has(type),
  };
}

export function buildPolicyImageContextView(
  type: IeltsAssignmentType,
  config: IeltsAssignmentConfig,
): PolicyImageContextView {
  if (type !== 'writing' || !isVisualWritingTask1(config)) {
    return {
      status: 'not-visual-writing',
      message: 'Image context is not needed for this assignment.',
    };
  }

  if (!config.task1.imageFileId) {
    return {
      status: 'missing-image',
      message:
        'Task 1 is visual, but image context is unavailable until a chart or diagram is attached.',
    };
  }

  return {
    status: 'available',
    message: 'The Task 1 image can be sent with AI writing feedback when the selected route supports image input.',
  };
}

export function buildAiFeedbackPolicyView(
  type: IeltsAssignmentType,
  config: IeltsAssignmentConfig,
): AiFeedbackPolicyView {
  const policy = normalizeAiPolicyForAssignmentType(type, config.aiPolicy);

  return {
    ...getPolicyAvailability(type),
    policy,
    imageContext: buildPolicyImageContextView(type, config),
    providerTierLabel: providerTierLabels[policy.providerTier],
    writingFeedbackLabel: writingFeedbackLabels[policy.writingFeedbackMode],
  };
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
}

function addList(lines: string[], label: string, value: unknown) {
  const items = stringArray(value);
  if (items.length === 0) {
    return;
  }
  lines.push(`\n${label}:`);
  items.forEach((item) => lines.push(`- ${item}`));
}

export function extractEditableFeedback(feedback: Record<string, unknown> | null | undefined): string {
  if (!feedback) {
    return '';
  }

  const direct =
    typeof feedback.feedbackMd === 'string'
      ? feedback.feedbackMd
      : typeof feedback.feedback === 'string'
        ? feedback.feedback
        : typeof feedback.content === 'string'
          ? feedback.content
          : '';

  if (direct.trim()) {
    return direct.trim();
  }

  const lines: string[] = [];
  if (typeof feedback.band_estimate === 'number') {
    lines.push(`Band estimate: ${feedback.band_estimate}`);
  }
  if (typeof feedback.rationale === 'string' && feedback.rationale.trim()) {
    lines.push(feedback.rationale.trim());
  }
  addList(lines, 'Strengths', feedback.strengths);
  addList(lines, 'Improvement areas', feedback.improvement_areas);
  addList(lines, 'Next steps', feedback.next_steps);
  if (typeof feedback.teacher_notes === 'string' && feedback.teacher_notes.trim()) {
    lines.push(`\nTeacher notes: ${feedback.teacher_notes.trim()}`);
  }

  return lines.join('\n').trim();
}

export function extractTeacherEditedFeedback(
  draft: Pick<WritingFeedbackReviewResponse, 'teacherEditedFeedback'>,
): string {
  return extractEditableFeedback(draft.teacherEditedFeedback ?? undefined);
}

export function buildWritingFeedbackDraftView(
  draft: WritingFeedbackReviewResponse | null | undefined,
): WritingFeedbackDraftView {
  if (!draft) {
    return {
      label: 'No draft',
      description: 'Request AI writing feedback to create a draft for teacher review.',
      canDecide: false,
      canRegenerate: false,
      canFinalize: false,
      tone: 'muted',
    };
  }

  if (draft.failureCode === 'image_context_unavailable') {
    return {
      label: 'Image context unavailable',
      description:
        draft.failureMessage ??
        'Task 1 is visual, but AI feedback could not use the task image.',
      canDecide: draft.status === 'review_required',
      canRegenerate: true,
      canFinalize: false,
      tone: 'warning',
    };
  }

  switch (draft.status) {
    case 'queued':
      return {
        label: 'Queued',
        description: 'AI writing feedback is queued. This draft is not student-visible yet.',
        canDecide: false,
        canRegenerate: false,
        canFinalize: false,
        tone: 'info',
      };
    case 'running':
      return {
        label: 'Running',
        description: 'AI writing feedback is being generated.',
        canDecide: false,
        canRegenerate: false,
        canFinalize: false,
        tone: 'info',
      };
    case 'accepted':
      return {
        label:
          draft.visibilityMode === 'instant_student_visible'
            ? 'Provisional feedback ready'
            : 'Teacher-reviewed draft ready',
        description:
          draft.visibilityMode === 'instant_student_visible'
            ? 'Instant provisional feedback can be edited and finalized as teacher-final feedback.'
            : 'Teacher-reviewed AI feedback is hidden from students until approval.',
        canDecide: true,
        canRegenerate: true,
        canFinalize: draft.visibilityMode === 'instant_student_visible',
        tone: 'success',
      };
    case 'review_required':
    case 'failed':
      return {
        label: draft.status === 'failed' ? 'Generation failed' : 'Review required',
        description:
          draft.failureMessage ??
          'Review the generated context before deciding whether to use or regenerate this draft.',
        canDecide: true,
        canRegenerate: true,
        canFinalize: false,
        tone: draft.status === 'failed' ? 'destructive' : 'warning',
      };
    case 'approved':
      return {
        label: 'Approved',
        description: 'Teacher-reviewed AI feedback has been published into grade feedback.',
        canDecide: false,
        canRegenerate: true,
        canFinalize: false,
        tone: 'success',
      };
    case 'finalized':
      return {
        label: 'Finalized',
        description: 'Provisional AI feedback has been replaced by teacher-final feedback.',
        canDecide: false,
        canRegenerate: true,
        canFinalize: false,
        tone: 'success',
      };
    case 'rejected':
      return {
        label: 'Rejected',
        description: 'This draft was rejected and retained for audit.',
        canDecide: false,
        canRegenerate: true,
        canFinalize: false,
        tone: 'muted',
      };
    case 'superseded':
      return {
        label: 'Superseded',
        description: 'A newer draft replaced this one.',
        canDecide: false,
        canRegenerate: true,
        canFinalize: false,
        tone: 'muted',
      };
  }
}

export function buildWritingFeedbackDecisionActionView(
  action: WritingFeedbackDecisionAction,
  hasExistingGrade: boolean,
): WritingFeedbackDecisionActionView {
  const actionLabel = action === 'approve' ? 'Approve' : 'Finalize';

  if (hasExistingGrade) {
    return {
      label: actionLabel,
      description: `${actionLabel} this AI feedback decision against the existing grade.`,
      mode: 'immediate',
    };
  }

  return {
    label: `${actionLabel} after posting grade`,
    description:
      'This decision will be recorded after Post Grade creates the grade required by the review workflow.',
    mode: 'after-grade-post',
  };
}

export function syncWritingFeedbackPendingDecisionFeedback(
  pendingDecision: WritingFeedbackPendingDecision,
  draftId: string,
  feedbackMd: string,
): WritingFeedbackPendingDecision {
  if (pendingDecision.draftId !== draftId) {
    return pendingDecision;
  }

  return {
    ...pendingDecision,
    feedbackMd: feedbackMd.trim(),
  };
}
