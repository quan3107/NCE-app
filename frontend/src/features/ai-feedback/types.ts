/**
 * Location: features/ai-feedback/types.ts
 * Purpose: Define frontend contracts for AI feedback API responses.
 * Why: Keeps teacher review UI aligned with backend draft and health schemas.
 */

export type AiFeedbackDraftStatus =
  | 'queued'
  | 'running'
  | 'accepted'
  | 'review_required'
  | 'rejected'
  | 'failed'
  | 'approved'
  | 'finalized'
  | 'superseded';

export type AiFeedbackVisibilityMode =
  | 'teacher_reviewed'
  | 'instant_student_visible'
  | 'hidden';

export type AiFeedbackDraftDecision =
  | 'accepted'
  | 'approved'
  | 'rejected'
  | 'finalized';

export type WritingFeedbackCriterionSuggestion = {
  criterion: string;
  points: number;
};

export type WritingFeedbackProviderCriterionSuggestion = {
  criterionId: string;
  band: number;
  rationale: string;
};

export type WritingFeedbackResponse = {
  id: string;
  status: AiFeedbackDraftStatus;
  visibilityMode: AiFeedbackVisibilityMode;
  pollingLocation?: string;
  feedback?: Record<string, unknown>;
  failureCode?: string;
  failureMessage?: string;
};

export type WritingFeedbackReviewResponse = WritingFeedbackResponse & {
  decision?: AiFeedbackDraftDecision | null;
  gradeId?: string | null;
  decidedAt?: string | null;
  finalizedAt?: string | null;
  teacherEditedFeedback?: Record<string, unknown> | null;
  normalizedCriterionSuggestions?: Array<
    WritingFeedbackCriterionSuggestion | WritingFeedbackProviderCriterionSuggestion
  > | null;
};

export type WritingFeedbackHistoryResponse = {
  drafts: WritingFeedbackReviewResponse[];
};

export type WritingFeedbackApprovalRequest = {
  feedbackMd: string;
  normalizedCriterionSuggestions?: WritingFeedbackCriterionSuggestion[];
};

export type WritingFeedbackRejectRequest = {
  reason?: string;
};

export type WritingFeedbackRegenerateRequest = {
  providerTier?: 'low_cost' | 'premium';
};

export type WritingFeedbackBatchRequest =
  | {
      submissionIds: string[];
      filter?: never;
    }
  | {
      filter: 'submitted' | 'ungraded';
      submissionIds?: never;
    };

export type WritingFeedbackBatchResult = {
  submissionId: string;
  status:
    | 'queued'
    | 'review_required'
    | 'skipped'
    | 'unauthorized'
    | 'policy_disabled'
    | 'failed_to_queue';
  draft?: WritingFeedbackResponse;
  reason?: string;
};

export type WritingFeedbackBatchResponse = {
  assignmentId: string;
  requestedCount: number;
  results: WritingFeedbackBatchResult[];
};
