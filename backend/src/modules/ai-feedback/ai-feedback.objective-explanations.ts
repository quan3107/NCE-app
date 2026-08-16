/**
 * File: src/modules/ai-feedback/ai-feedback.objective-explanations.ts
 * Purpose: Orchestrate on-demand objective explanation requests.
 * Why: Keeps access, deterministic evidence, cache keys, and queue payloads together.
 */
import type { RequestActor } from "../../middleware/requestActor.js";
import { createHttpError } from "../../utils/httpError.js";
import {
  AI_FEEDBACK_AUDIT_ACTIONS,
  recordAiFeedbackAudit,
} from "../audit-logs/ai-feedback-audit.js";
import { aiFeedbackConfig } from "./ai-feedback.config.js";
import {
  assertObjectiveGenerationReady,
  hasObjectiveSourceEvidence,
  loadObjectiveExplanationContext,
  modelForObjectiveRoute,
} from "./ai-feedback.objective-context.js";
import {
  findAiObjectiveExplanationByCacheKey,
  upsertAiObjectiveExplanation,
} from "./ai-feedback.repository.js";
import { OBJECTIVE_EXPLANATION_PROMPT_VERSION } from "./prompts/system.js";

type ObjectiveExplanationResponse = {
  id: string;
  status: string;
  cached: boolean;
  pollingLocation?: string;
  explanation?: unknown;
  failureCode?: string;
  failureMessage?: string;
};

const INSUFFICIENT_SOURCE_EVIDENCE_CODE = "insufficient_source_evidence";
const INSUFFICIENT_SOURCE_EVIDENCE_MESSAGE =
  "This question does not include enough source text for a source-backed AI explanation.";

function pollingLocation(submissionId: string, questionId: string): string {
  return `/api/v1/submissions/${submissionId}/questions/${questionId}/ai-explanation`;
}

function toObjectiveExplanationResponse(
  explanation: {
    id: string;
    status: string;
    generatedExplanation?: unknown;
    failureCode?: string | null;
    failureMessage?: string | null;
  },
  params: {
    submissionId: string;
    questionId: string;
  },
): ObjectiveExplanationResponse {
  const completed =
    explanation.status === "completed" && !!explanation.generatedExplanation;
  const active =
    explanation.status === "queued" || explanation.status === "running";

  return {
    id: explanation.id,
    status: explanation.status,
    cached: completed,
    ...(active
      ? {
          pollingLocation: pollingLocation(
            params.submissionId,
            params.questionId,
          ),
        }
      : {}),
    ...(completed ? { explanation: explanation.generatedExplanation } : {}),
    ...(explanation.failureCode
      ? { failureCode: explanation.failureCode }
      : {}),
    ...(explanation.failureMessage
      ? { failureMessage: explanation.failureMessage }
      : {}),
  };
}

export async function requestAiObjectiveExplanation(
  params: unknown,
  actor?: RequestActor,
): Promise<ObjectiveExplanationResponse> {
  const context = await loadObjectiveExplanationContext(params, actor);

  assertObjectiveGenerationReady();

  if (!hasObjectiveSourceEvidence(context.evidence)) {
    const explanation = await upsertAiObjectiveExplanation({
      submissionId: context.submission.id,
      assignmentId: context.submission.assignmentId,
      requesterId: context.actor.id,
      questionId: context.questionId,
      deterministicResult: context.evidence.deterministicResult,
      promptVersion: OBJECTIVE_EXPLANATION_PROMPT_VERSION,
      sourceContextHash: context.sourceContextHash,
      routeKey: context.routeKey,
      provider: aiFeedbackConfig.provider,
      model: modelForObjectiveRoute(context.routeKey),
      status: "rejected",
      failureCode: INSUFFICIENT_SOURCE_EVIDENCE_CODE,
      failureMessage: INSUFFICIENT_SOURCE_EVIDENCE_MESSAGE,
    });
    await recordAiFeedbackAudit({
      actorId: context.actor.id,
      action: AI_FEEDBACK_AUDIT_ACTIONS.explanationFailed,
      entity: "ai_objective_explanation",
      entityId: explanation.id,
      eventData: {
        submissionId: context.submission.id,
        assignmentId: context.submission.assignmentId,
        routeKey: context.routeKey,
        provider: aiFeedbackConfig.provider,
        model: modelForObjectiveRoute(context.routeKey),
        promptVersion: OBJECTIVE_EXPLANATION_PROMPT_VERSION,
        status: explanation.status,
        failureCode: INSUFFICIENT_SOURCE_EVIDENCE_CODE,
        outputGenerated: false,
      },
    });

    return toObjectiveExplanationResponse(explanation, {
      submissionId: context.submission.id,
      questionId: context.questionId,
    });
  }

  const explanation = await upsertAiObjectiveExplanation({
    submissionId: context.submission.id,
    assignmentId: context.submission.assignmentId,
    requesterId: context.actor.id,
    questionId: context.questionId,
    deterministicResult: context.evidence.deterministicResult,
    promptVersion: OBJECTIVE_EXPLANATION_PROMPT_VERSION,
    sourceContextHash: context.sourceContextHash,
    routeKey: context.routeKey,
    provider: aiFeedbackConfig.provider,
    model: modelForObjectiveRoute(context.routeKey),
    status: "queued",
    generationJob: {
      harnessInput: {
        fixtureId: `objective-explanation:${context.submission.id}:${context.questionId}`,
        taskType: "objective_explanation",
        promptInput: context.promptInput,
        routeKey: context.routeKey,
      },
    },
  });
  const eventData = {
    submissionId: context.submission.id,
    assignmentId: context.submission.assignmentId,
    routeKey: context.routeKey,
    provider: aiFeedbackConfig.provider,
    model: modelForObjectiveRoute(context.routeKey),
    promptVersion: OBJECTIVE_EXPLANATION_PROMPT_VERSION,
  };
  if (
    explanation.status === "failed" ||
    explanation.status === "review_required"
  ) {
    await recordAiFeedbackAudit({
      actorId: context.actor.id,
      action: AI_FEEDBACK_AUDIT_ACTIONS.explanationFailed,
      entity: "ai_objective_explanation",
      entityId: explanation.id,
      eventData: {
        ...eventData,
        status: explanation.status,
        outputGenerated: false,
      },
    });
  } else {
    await recordAiFeedbackAudit({
      actorId: context.actor.id,
      action: AI_FEEDBACK_AUDIT_ACTIONS.explanationRequested,
      entity: "ai_objective_explanation",
      entityId: explanation.id,
      eventData: {
        ...eventData,
        status: explanation.status,
        promptUsed: true,
        sourceEvidenceUsed: true,
      },
    });
  }

  return toObjectiveExplanationResponse(explanation, {
    submissionId: context.submission.id,
    questionId: context.questionId,
  });
}

export async function getAiObjectiveExplanationStatus(
  params: unknown,
  actor?: RequestActor,
): Promise<ObjectiveExplanationResponse> {
  const context = await loadObjectiveExplanationContext(params, actor);
  const explanation = await findAiObjectiveExplanationByCacheKey({
    submissionId: context.submission.id,
    assignmentId: context.submission.assignmentId,
    requesterId: context.actor.id,
    questionId: context.questionId,
    deterministicResult: context.evidence.deterministicResult,
    promptVersion: OBJECTIVE_EXPLANATION_PROMPT_VERSION,
    sourceContextHash: context.sourceContextHash,
    routeKey: context.routeKey,
  });

  if (!explanation) {
    throw createHttpError(404, "AI objective explanation not found.");
  }

  return toObjectiveExplanationResponse(explanation, {
    submissionId: context.submission.id,
    questionId: context.questionId,
  });
}
