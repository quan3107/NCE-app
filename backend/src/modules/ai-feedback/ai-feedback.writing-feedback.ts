/**
 * File: src/modules/ai-feedback/ai-feedback.writing-feedback.ts
 * Purpose: Orchestrate IELTS writing AI feedback draft generation requests.
 * Why: Keeps public manual and automatic entry points small and testable.
 */
import type { RequestActor } from "../../middleware/requestActor.js";
import {
  AI_FEEDBACK_AUDIT_ACTIONS,
  recordAiFeedbackAudit,
} from "../audit-logs/ai-feedback-audit.js";
import { aiFeedbackConfig } from "./ai-feedback.config.js";
import {
  createAiFeedbackDraft,
  findLatestAiFeedbackDraftBySubmission,
  supersedeAiFeedbackDrafts,
} from "./ai-feedback.repository.js";
import {
  aiWritingFeedbackRegenerateBodySchema,
  type AiWritingFeedbackRegenerateBody,
  type WritingFeedbackResponse,
} from "./ai-feedback.schema.js";
import {
  loadWritingFeedbackContext,
  loadWritingFeedbackStatusContext,
} from "./ai-feedback.writing-feedback.context.js";
import {
  assertAiFeedbackGenerationReady,
  imageUnavailableFeedback,
  modelForRouteKey,
  reasoningEffortForRouteKey,
  toWritingFeedbackResponse,
} from "./ai-feedback.writing-feedback.support.js";
import type { WritingFeedbackContext } from "./ai-feedback.writing-feedback.types.js";
import { createHttpError } from "../../utils/httpError.js";
import { buildIeltsWritingFeedbackPrompt } from "./prompts/index.js";
import { IELTS_WRITING_FEEDBACK_PROMPT_VERSION } from "./prompts/system.js";
import type { AiConcreteProviderRouteKey } from "./provider.types.js";

type WritingFeedbackRequestOptions = {
  providerTierOverride?: AiConcreteProviderRouteKey;
};

async function createWritingDraftForContext(
  context: WritingFeedbackContext,
  options: WritingFeedbackRequestOptions = {},
) {
  const prompt = buildIeltsWritingFeedbackPrompt(context.promptInput);
  const routeKey = options.providerTierOverride ?? context.routeKey;

  assertAiFeedbackGenerationReady();

  if (prompt.imageContextFailure) {
    return createAiFeedbackDraft({
      submissionId: context.submission.id,
      assignmentId: context.submission.assignmentId,
      requesterId: context.actor.id,
      gradeId: context.submission.grade?.id,
      promptVersion: IELTS_WRITING_FEEDBACK_PROMPT_VERSION,
      routeKey,
      provider: aiFeedbackConfig.provider,
      model: modelForRouteKey(routeKey),
      reasoningEffort: reasoningEffortForRouteKey(routeKey),
      inputHash: context.inputHash,
      status: "review_required",
      visibilityMode: "teacher_reviewed",
      generatedFeedback: imageUnavailableFeedback(prompt),
      failureCode: prompt.imageContextFailure.failureCode,
      failureMessage: prompt.imageContextFailure.failureMessage,
    });
  }

  return createAiFeedbackDraft({
    submissionId: context.submission.id,
    assignmentId: context.submission.assignmentId,
    requesterId: context.actor.id,
    gradeId: context.submission.grade?.id,
    promptVersion: IELTS_WRITING_FEEDBACK_PROMPT_VERSION,
    routeKey,
    provider: aiFeedbackConfig.provider,
    model: modelForRouteKey(routeKey),
    reasoningEffort: reasoningEffortForRouteKey(routeKey),
    inputHash: context.inputHash,
    status: "queued",
    visibilityMode: context.visibilityMode,
    generatedFeedback: {
      status: "queued",
      message: "AI writing feedback generation is queued.",
    },
    generationJob: {
      harnessInput: {
        fixtureId: `writing-feedback:${context.submission.id}:${context.inputHash}`,
        taskType: "writing_feedback",
        promptInput: context.promptInput,
        routeKey,
      },
    },
  });
}

async function auditWritingDraftRequest(
  context: WritingFeedbackContext,
  draft: {
    id: string;
    status: string;
    provider?: string | null;
    model?: string | null;
    failureCode?: string | null;
    failureMessage?: string | null;
  },
  routeKey: AiConcreteProviderRouteKey,
): Promise<void> {
  const failed =
    draft.status === "failed" || draft.status === "review_required";

  await recordAiFeedbackAudit({
    actorId: context.actor.id,
    action: failed
      ? AI_FEEDBACK_AUDIT_ACTIONS.writingFailed
      : AI_FEEDBACK_AUDIT_ACTIONS.writingRequested,
    entity: "ai_feedback_draft",
    entityId: draft.id,
    entityIds: {
      submissionId: context.submission.id,
      assignmentId: context.submission.assignmentId,
      ...(context.submission.grade?.id
        ? { gradeId: context.submission.grade.id }
        : {}),
    },
    routeKey,
    provider: draft.provider ?? aiFeedbackConfig.provider,
    model: draft.model ?? modelForRouteKey(routeKey),
    promptVersion: IELTS_WRITING_FEEDBACK_PROMPT_VERSION,
    payload: {
      status: draft.status,
      visibilityMode: context.visibilityMode,
      inputHash: context.inputHash,
      promptInput: context.promptInput,
      ...(draft.failureCode ? { failureCode: draft.failureCode } : {}),
      ...(draft.failureMessage ? { failureMessage: draft.failureMessage } : {}),
    },
  });
}

export async function requestAiWritingFeedback(
  params: unknown,
  actor?: RequestActor,
  options: WritingFeedbackRequestOptions = {},
): Promise<WritingFeedbackResponse> {
  const context = await loadWritingFeedbackContext(params, actor, "manual");
  const draft = await createWritingDraftForContext(context, options);
  await supersedeAiFeedbackDrafts({
    submissionId: context.submission.id,
    exceptDraftId: draft.id,
  });
  await auditWritingDraftRequest(
    context,
    draft,
    options.providerTierOverride ?? context.routeKey,
  );

  return toWritingFeedbackResponse(draft);
}

export function regenerateAiWritingFeedback(
  params: unknown,
  payload: unknown,
  actor?: RequestActor,
): Promise<WritingFeedbackResponse> {
  const data: AiWritingFeedbackRegenerateBody =
    aiWritingFeedbackRegenerateBodySchema.parse(payload ?? {});

  return requestAiWritingFeedback(params, actor, {
    providerTierOverride: data.providerTier,
  });
}

export async function getAiWritingFeedbackStatus(
  params: unknown,
  actor?: RequestActor,
): Promise<WritingFeedbackResponse> {
  const context = await loadWritingFeedbackStatusContext(params, actor);
  const draft = await findLatestAiFeedbackDraftBySubmission(context.submissionId);

  if (!draft) {
    throw createHttpError(404, "AI writing feedback draft not found.");
  }

  return toWritingFeedbackResponse(draft);
}

export async function enqueueAiWritingFeedbackForSubmission(
  submissionId: string,
  actor: RequestActor,
): Promise<WritingFeedbackResponse | null> {
  const context = await loadWritingFeedbackContext(
    { submissionId },
    actor,
    "automatic",
  );
  const draft = await createWritingDraftForContext(context);
  await supersedeAiFeedbackDrafts({
    submissionId: context.submission.id,
    exceptDraftId: draft.id,
  });
  await auditWritingDraftRequest(context, draft, context.routeKey);

  return toWritingFeedbackResponse(draft);
}
