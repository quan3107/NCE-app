/**
 * File: src/modules/ai-feedback/ai-feedback.writing-feedback.ts
 * Purpose: Orchestrate IELTS writing AI feedback draft generation requests.
 * Why: Keeps public manual and automatic entry points small and testable.
 */
import type { RequestActor } from "../../middleware/requestActor.js";
import { aiFeedbackConfig } from "./ai-feedback.config.js";
import {
  createAiFeedbackDraft,
  supersedeAiFeedbackDrafts,
} from "./ai-feedback.repository.js";
import type { WritingFeedbackResponse } from "./ai-feedback.schema.js";
import { loadWritingFeedbackContext } from "./ai-feedback.writing-feedback.context.js";
import {
  assertAiFeedbackGenerationReady,
  imageUnavailableFeedback,
  modelForRouteKey,
  reasoningEffortForRouteKey,
  toWritingFeedbackResponse,
} from "./ai-feedback.writing-feedback.support.js";
import type { WritingFeedbackContext } from "./ai-feedback.writing-feedback.types.js";
import { buildIeltsWritingFeedbackPrompt } from "./prompts/index.js";
import { IELTS_WRITING_FEEDBACK_PROMPT_VERSION } from "./prompts/system.js";

async function createWritingDraftForContext(
  context: WritingFeedbackContext,
) {
  const prompt = buildIeltsWritingFeedbackPrompt(context.promptInput);

  assertAiFeedbackGenerationReady();

  if (prompt.imageContextFailure) {
    return createAiFeedbackDraft({
      submissionId: context.submission.id,
      assignmentId: context.submission.assignmentId,
      requesterId: context.actor.id,
      gradeId: context.submission.grade?.id,
      promptVersion: IELTS_WRITING_FEEDBACK_PROMPT_VERSION,
      routeKey: context.routeKey,
      provider: aiFeedbackConfig.provider,
      model: modelForRouteKey(context.routeKey),
      reasoningEffort: reasoningEffortForRouteKey(context.routeKey),
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
    routeKey: context.routeKey,
    provider: aiFeedbackConfig.provider,
    model: modelForRouteKey(context.routeKey),
    reasoningEffort: reasoningEffortForRouteKey(context.routeKey),
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
        routeKey: context.routeKey,
      },
    },
  });
}

export async function requestAiWritingFeedback(
  params: unknown,
  actor?: RequestActor,
): Promise<WritingFeedbackResponse> {
  const context = await loadWritingFeedbackContext(params, actor, "manual");
  const draft = await createWritingDraftForContext(context);
  await supersedeAiFeedbackDrafts({
    submissionId: context.submission.id,
    exceptDraftId: draft.id,
  });

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

  return toWritingFeedbackResponse(draft);
}
