/**
 * File: src/modules/ai-feedback/ai-feedback.schema.ts
 * Purpose: Define AI feedback health endpoint response contracts.
 * Why: Prevents provider readiness responses from drifting or leaking secrets.
 */
import { z } from "zod";

import {
  objectiveGenerationJobSchema,
  writingGenerationJobSchema,
} from "./ai-feedback.generationJob.schema.js";

export const aiFeedbackDraftStatusSchema = z.enum([
  "queued",
  "running",
  "accepted",
  "review_required",
  "rejected",
  "failed",
  "approved",
  "finalized",
  "superseded",
]);

export const aiFeedbackVisibilityModeSchema = z.enum([
  "teacher_reviewed",
  "instant_student_visible",
  "hidden",
]);

export const aiFeedbackDraftDecisionSchema = z.enum([
  "accepted",
  "approved",
  "rejected",
  "finalized",
]);

export const aiObjectiveExplanationStatusSchema = z.enum([
  "queued",
  "running",
  "completed",
  "review_required",
  "rejected",
  "failed",
]);

export const aiFeedbackHealthStatusSchema = z.enum([
  "disabled",
  "configured",
  "healthy",
  "unhealthy",
  "timeout",
  "misconfigured",
]);

export const aiReasoningEffortResponseSchema = z.enum([
  "none",
  "low",
  "medium",
  "high",
  "xhigh",
]);

const jsonRecordSchema = z.record(z.string(), z.unknown());
const jsonArraySchema = z.array(z.unknown());

export const createAiFeedbackDraftSchema = z
  .object({
    submissionId: z.string().uuid(),
    assignmentId: z.string().uuid(),
    requesterId: z.string().uuid(),
    gradeId: z.string().uuid().optional(),
    promptVersion: z.string().min(1),
    routeKey: z.string().min(1),
    provider: z.string().min(1),
    model: z.string().min(1),
    reasoningEffort: aiReasoningEffortResponseSchema.optional(),
    inputHash: z.string().min(1),
    status: aiFeedbackDraftStatusSchema.default("queued"),
    visibilityMode: aiFeedbackVisibilityModeSchema,
    generatedFeedback: jsonRecordSchema,
    teacherEditedFeedback: jsonRecordSchema.optional(),
    normalizedCriterionSuggestions: jsonArraySchema.optional(),
    criteriaVersion: z.string().min(1).optional(),
    safetyFlags: jsonRecordSchema.optional(),
    failureCode: z.string().min(1).optional(),
    failureMessage: z.string().min(1).optional(),
    retryCount: z.number().int().min(0).optional(),
    nextRetryAt: z.date().optional(),
    lastAttemptAt: z.date().optional(),
    generationJob: writingGenerationJobSchema.optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.status === "queued" && !data.generationJob) {
      ctx.addIssue({
        code: "custom",
        path: ["generationJob"],
        message: "Queued AI feedback drafts require a generation job payload.",
      });
    }
  });

export const studentVisibleAiFeedbackDraftParamsSchema = z
  .object({
    submissionId: z.string().uuid(),
    studentId: z.string().uuid(),
  })
  .strict();

export const aiFeedbackDraftDecisionInputSchema = z
  .object({
    draftId: z.string().uuid(),
    actorId: z.string().uuid(),
    decision: aiFeedbackDraftDecisionSchema,
    gradeId: z.string().uuid().optional(),
    teacherEditedFeedback: jsonRecordSchema.optional(),
  })
  .strict();

export const supersedeAiFeedbackDraftsSchema = z
  .object({
    submissionId: z.string().uuid(),
    exceptDraftId: z.string().uuid().optional(),
  })
  .strict();

export const upsertAiObjectiveExplanationSchema = z
  .object({
    submissionId: z.string().uuid(),
    assignmentId: z.string().uuid(),
    requesterId: z.string().uuid(),
    questionId: z.string().min(1),
    deterministicResult: z.string().min(1),
    promptVersion: z.string().min(1),
    sourceContextHash: z.string().min(1),
    routeKey: z.string().min(1),
    provider: z.string().min(1),
    model: z.string().min(1),
    status: aiObjectiveExplanationStatusSchema.default("completed"),
    generatedExplanation: jsonRecordSchema.optional(),
    failureCode: z.string().min(1).optional(),
    failureMessage: z.string().min(1).optional(),
    retryCount: z.number().int().min(0).optional(),
    nextRetryAt: z.date().optional(),
    lastAttemptAt: z.date().optional(),
    generationJob: objectiveGenerationJobSchema.optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.status === "queued" && !data.generationJob) {
      ctx.addIssue({
        code: "custom",
        path: ["generationJob"],
        message:
          "Queued AI objective explanations require a generation job payload.",
      });
    }
  });

export const findAiObjectiveExplanationByCacheKeySchema = z
  .object({
    submissionId: z.string().uuid(),
    assignmentId: z.string().uuid(),
    requesterId: z.string().uuid(),
    questionId: z.string().min(1),
    deterministicResult: z.string().min(1),
    promptVersion: z.string().min(1),
    sourceContextHash: z.string().min(1),
    routeKey: z.string().min(1),
  })
  .strict();

export const aiGenerationStatusRequestSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("writing_draft"),
      id: z.string().uuid(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("objective_explanation"),
      id: z.string().uuid(),
    })
    .strict(),
]);

export const objectiveExplanationRequestParamsSchema = z
  .object({
    submissionId: z.string().uuid(),
    questionId: z.string().min(1),
  })
  .strict();

export const writingFeedbackRequestParamsSchema = z
  .object({
    submissionId: z.string().uuid(),
  })
  .strict();

export const writingFeedbackDraftParamsSchema = z
  .object({
    submissionId: z.string().uuid(),
    draftId: z.string().uuid(),
  })
  .strict();

export const aiFeedbackCriterionSuggestionSchema = z
  .object({
    criterion: z.string().min(1),
    points: z.number(),
  })
  .strict();

export const aiWritingFeedbackApprovalBodySchema = z
  .object({
    feedbackMd: z.string().trim().min(1),
    normalizedCriterionSuggestions: z
      .array(aiFeedbackCriterionSuggestionSchema)
      .optional(),
  })
  .strict();

export const aiWritingFeedbackRejectBodySchema = z
  .object({
    reason: z.string().trim().min(1).optional(),
  })
  .strict();

export const aiWritingFeedbackRegenerateBodySchema = z
  .object({
    providerTier: z.enum(["low_cost", "premium"]).optional(),
  })
  .strict();

export const assignmentWritingFeedbackBatchParamsSchema = z
  .object({
    courseId: z.string().uuid().optional(),
    assignmentId: z.string().uuid(),
  })
  .strict();

export const aiWritingFeedbackBatchFilterSchema = z.enum([
  "submitted",
  "ungraded",
]);

export const aiWritingFeedbackBatchRequestSchema = z
  .object({
    submissionIds: z.array(z.string().uuid()).min(1).max(100).optional(),
    filter: aiWritingFeedbackBatchFilterSchema.optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    const selectorCount = Number(Boolean(data.submissionIds)) + Number(Boolean(data.filter));

    if (selectorCount !== 1) {
      ctx.addIssue({
        code: "custom",
        message: "Provide exactly one batch selector: submissionIds or filter.",
      });
    }
  });

const aiRouteMetadataSchema = z.object({
  model: z.string().min(1),
  reasoning_effort: aiReasoningEffortResponseSchema,
  supports_image_input: z.boolean(),
});

export const aiFeedbackHealthResponseSchema = z.object({
  status: aiFeedbackHealthStatusSchema,
  enabled: z.boolean(),
  checked_at: z.string().datetime(),
  provider: z.object({
    name: z.string().min(1),
    base_url: z.string().min(1),
    health_path: z.string(),
    http_status: z.number().int().optional(),
  }),
  limits: z.object({
    timeout_ms: z.number().int().positive(),
    max_input_chars: z.number().int().positive(),
    max_output_tokens: z.number().int().positive(),
    image_max_bytes: z.number().int().positive(),
    image_supported_mime_types: z.array(z.string().min(1)),
  }),
  routes: z.object({
    low_cost: aiRouteMetadataSchema,
    premium: aiRouteMetadataSchema,
  }),
  problem: z.string().optional(),
});

export const objectiveExplanationResponseSchema = z.object({
  id: z.string().uuid(),
  status: aiObjectiveExplanationStatusSchema,
  cached: z.boolean(),
  pollingLocation: z.string().min(1).optional(),
  explanation: jsonRecordSchema.optional(),
});

export const writingFeedbackResponseSchema = z.object({
  id: z.string().uuid(),
  status: aiFeedbackDraftStatusSchema,
  visibilityMode: aiFeedbackVisibilityModeSchema,
  pollingLocation: z.string().min(1).optional(),
  feedback: jsonRecordSchema.optional(),
  failureCode: z.string().min(1).optional(),
  failureMessage: z.string().min(1).optional(),
});

export const writingFeedbackReviewResponseSchema =
  writingFeedbackResponseSchema.extend({
    decision: aiFeedbackDraftDecisionSchema.nullable().optional(),
    gradeId: z.string().uuid().nullable().optional(),
    decidedAt: z.string().datetime().nullable().optional(),
    finalizedAt: z.string().datetime().nullable().optional(),
    teacherEditedFeedback: jsonRecordSchema.nullable().optional(),
    normalizedCriterionSuggestions: jsonArraySchema.nullable().optional(),
  });

export const writingFeedbackHistoryResponseSchema = z.object({
  drafts: z.array(writingFeedbackReviewResponseSchema),
});

export const aiWritingFeedbackBatchResultSchema = z.object({
  submissionId: z.string().uuid(),
  status: z.enum(["queued", "review_required", "skipped", "unauthorized", "failed_to_queue"]),
  draft: writingFeedbackResponseSchema.optional(),
  reason: z.string().min(1).optional(),
});

export const aiWritingFeedbackBatchResponseSchema = z.object({
  assignmentId: z.string().uuid(),
  requestedCount: z.number().int().min(0),
  results: z.array(aiWritingFeedbackBatchResultSchema),
});

export type AiFeedbackHealthStatus = z.infer<
  typeof aiFeedbackHealthStatusSchema
>;
export type AiFeedbackHealthResponse = z.infer<
  typeof aiFeedbackHealthResponseSchema
>;
export type CreateAiFeedbackDraftInput = z.infer<
  typeof createAiFeedbackDraftSchema
>;
export type StudentVisibleAiFeedbackDraftParams = z.infer<
  typeof studentVisibleAiFeedbackDraftParamsSchema
>;
export type AiFeedbackDraftDecisionInput = z.infer<
  typeof aiFeedbackDraftDecisionInputSchema
>;
export type SupersedeAiFeedbackDraftsInput = z.infer<
  typeof supersedeAiFeedbackDraftsSchema
>;
export type UpsertAiObjectiveExplanationInput = z.infer<
  typeof upsertAiObjectiveExplanationSchema
>;
export type FindAiObjectiveExplanationByCacheKeyInput = z.infer<
  typeof findAiObjectiveExplanationByCacheKeySchema
>;
export type AiGenerationStatusRequest = z.infer<
  typeof aiGenerationStatusRequestSchema
>;
export type ObjectiveExplanationRequestParams = z.infer<
  typeof objectiveExplanationRequestParamsSchema
>;
export type ObjectiveExplanationResponse = z.infer<
  typeof objectiveExplanationResponseSchema
>;
export type WritingFeedbackRequestParams = z.infer<
  typeof writingFeedbackRequestParamsSchema
>;
export type WritingFeedbackDraftParams = z.infer<
  typeof writingFeedbackDraftParamsSchema
>;
export type AiWritingFeedbackApprovalBody = z.infer<
  typeof aiWritingFeedbackApprovalBodySchema
>;
export type AiWritingFeedbackRejectBody = z.infer<
  typeof aiWritingFeedbackRejectBodySchema
>;
export type AiWritingFeedbackRegenerateBody = z.infer<
  typeof aiWritingFeedbackRegenerateBodySchema
>;
export type AssignmentWritingFeedbackBatchParams = z.infer<
  typeof assignmentWritingFeedbackBatchParamsSchema
>;
export type AiWritingFeedbackBatchRequest = z.infer<
  typeof aiWritingFeedbackBatchRequestSchema
>;
export type WritingFeedbackResponse = z.infer<
  typeof writingFeedbackResponseSchema
>;
export type WritingFeedbackReviewResponse = z.infer<
  typeof writingFeedbackReviewResponseSchema
>;
export type WritingFeedbackHistoryResponse = z.infer<
  typeof writingFeedbackHistoryResponseSchema
>;
export type AiWritingFeedbackBatchResponse = z.infer<
  typeof aiWritingFeedbackBatchResponseSchema
>;
