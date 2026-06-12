/**
 * File: src/jobs/aiFeedbackJob.processing.ts
 * Purpose: Process queued AI feedback draft and objective explanation jobs.
 * Why: Provider calls, harness validation, and persistence are cohesive worker behavior.
 */
import type PgBoss from "pg-boss";
import { z } from "zod";

import { logger } from "../config/logger.js";
import {
  AI_FEEDBACK_AUDIT_ACTIONS,
  recordAiFeedbackAudit,
} from "../modules/audit-logs/ai-feedback-audit.js";
import {
  objectiveExplanationJobPayloadSchema,
  writingDraftJobPayloadSchema,
} from "../modules/ai-feedback/ai-feedback.generationJob.schema.js";
import { evaluateAiFeedbackHarness } from "../modules/ai-feedback/harness/harness.service.js";
import {
  parseObjectiveExplanationOutput,
  parseWritingFeedbackOutput,
} from "../modules/ai-feedback/parser.js";
import { createAiProviderRouterFromConfig } from "../modules/ai-feedback/provider.factory.js";
import {
  buildIeltsWritingFeedbackPrompt,
  buildObjectiveExplanationPrompt,
} from "../modules/ai-feedback/prompts/index.js";
import { prisma } from "../prisma/client.js";
import {
  failureMessage,
  shouldProcess,
  toJsonArray,
  toJsonObject,
  updateObjectiveProviderFailure,
  updateWritingProviderFailure,
} from "./aiFeedbackJob.persistence.js";
import type {
  AiFeedbackJobDeps,
  ObjectiveExplanationJobPayload,
  WritingDraftJobPayload,
} from "./aiFeedbackJob.types.js";

const writingDraftJobRecordSchema = z
  .object({
    draftId: z.string().uuid(),
  })
  .passthrough();

const objectiveExplanationJobRecordSchema = z
  .object({
    explanationId: z.string().uuid(),
  })
  .passthrough();

function getProviderRouter(deps: AiFeedbackJobDeps) {
  return deps.providerRouter ?? createAiProviderRouterFromConfig();
}

function invalidPayloadMessage(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");
}

async function markMalformedWritingPayloadFailed(
  data: unknown,
  error: z.ZodError,
  now: Date,
): Promise<boolean> {
  const record = writingDraftJobRecordSchema.safeParse(data);

  if (!record.success) {
    return false;
  }

  await prisma.aiFeedbackDraft.updateMany({
    where: {
      id: record.data.draftId,
      status: {
        in: ["queued", "failed"],
      },
      deletedAt: null,
    },
    data: {
      status: "failed",
      failureCode: "invalid_job_payload",
      failureMessage: invalidPayloadMessage(error),
      nextRetryAt: null,
      lastAttemptAt: now,
    },
  });

  return true;
}

async function markMalformedObjectivePayloadFailed(
  data: unknown,
  error: z.ZodError,
  now: Date,
): Promise<boolean> {
  const record = objectiveExplanationJobRecordSchema.safeParse(data);

  if (!record.success) {
    return false;
  }

  await prisma.aiObjectiveExplanation.updateMany({
    where: {
      id: record.data.explanationId,
      status: {
        in: ["queued", "failed"],
      },
      deletedAt: null,
    },
    data: {
      status: "failed",
      failureCode: "invalid_job_payload",
      failureMessage: invalidPayloadMessage(error),
      nextRetryAt: null,
      lastAttemptAt: now,
    },
  });

  return true;
}

export async function processWritingDraftJob(
  job: PgBoss.Job<WritingDraftJobPayload>,
  deps: AiFeedbackJobDeps,
): Promise<void> {
  const parsedPayload = writingDraftJobPayloadSchema.safeParse(job.data);

  if (!parsedPayload.success) {
    const handled = await markMalformedWritingPayloadFailed(
      job.data,
      parsedPayload.error,
      deps.now?.() ?? new Date(),
    );

    if (handled) {
      return;
    }

    throw parsedPayload.error;
  }

  const payload = parsedPayload.data as WritingDraftJobPayload;
  const draft = await prisma.aiFeedbackDraft.findUnique({
    where: { id: payload.draftId },
    select: {
      id: true,
      requesterId: true,
      submissionId: true,
      assignmentId: true,
      promptVersion: true,
      provider: true,
      status: true,
      retryCount: true,
      deletedAt: true,
    },
  });

  if (!draft || draft.deletedAt || !shouldProcess(draft.status)) {
    return;
  }

  const now = deps.now?.() ?? new Date();

  const runningTransition = await prisma.aiFeedbackDraft.updateMany({
    where: {
      id: draft.id,
      status: draft.status,
      deletedAt: null,
    },
    data: {
      status: "running",
      lastAttemptAt: now,
      nextRetryAt: null,
      failureCode: null,
      failureMessage: null,
    },
  });

  if (runningTransition.count === 0) {
    return;
  }

  try {
    const builtPrompt = buildIeltsWritingFeedbackPrompt(
      payload.harnessInput.promptInput,
    );
    const providerResult = await getProviderRouter(deps).generate(
      builtPrompt.request,
    );
    const harnessResult = evaluateAiFeedbackHarness({
      ...payload.harnessInput,
      providerOutput: providerResult.rawText,
      routeKey: providerResult.routeKey,
    });
    const parsed = parseWritingFeedbackOutput(providerResult.rawText, {
      writingScope: "combined",
    });
    const accepted = parsed.status === "accepted";

    await prisma.aiFeedbackDraft.updateMany({
      where: {
        id: draft.id,
        status: "running",
        deletedAt: null,
      },
      data: {
        status: harnessResult.status,
        routeKey: providerResult.routeKey,
        model: providerResult.model,
        ...(accepted
          ? {
              generatedFeedback: toJsonObject(parsed.feedback),
              normalizedCriterionSuggestions: toJsonArray(
                parsed.normalizedCriterionSuggestions,
              ),
              criteriaVersion: parsed.criteriaVersion,
              safetyFlags: toJsonObject(parsed.safetyFlags),
            }
          : {
              generatedFeedback: toJsonObject({
                harness: {
                  status: harnessResult.status,
                  reasonCode: harnessResult.reasonCode,
                  validationErrors: harnessResult.validationErrors,
                },
              }),
            }),
        failureCode:
          harnessResult.status === "accepted" ? null : harnessResult.reasonCode,
        failureMessage:
          harnessResult.status === "accepted"
            ? null
            : failureMessage(harnessResult.validationErrors),
        nextRetryAt: null,
        lastAttemptAt: now,
      },
    });
    await recordAiFeedbackAudit({
      actorId: draft.requesterId,
      action: accepted
        ? AI_FEEDBACK_AUDIT_ACTIONS.writingGenerated
        : AI_FEEDBACK_AUDIT_ACTIONS.writingFailed,
      entity: "ai_feedback_draft",
      entityId: draft.id,
      entityIds: {
        submissionId: draft.submissionId,
        assignmentId: draft.assignmentId,
      },
      routeKey: providerResult.routeKey,
      provider: draft.provider,
      model: providerResult.model,
      promptVersion: draft.promptVersion,
      payload: {
        status: harnessResult.status,
        reasonCode: harnessResult.reasonCode,
        validationErrors: harnessResult.validationErrors,
        providerOutput: providerResult.rawText,
        promptInput: payload.harnessInput.promptInput,
      },
    });
  } catch (error) {
    logger.error(
      { err: error, draftId: draft.id },
      "AI writing draft generation failed",
    );
    await recordAiFeedbackAudit({
      actorId: draft.requesterId,
      action: AI_FEEDBACK_AUDIT_ACTIONS.writingFailed,
      entity: "ai_feedback_draft",
      entityId: draft.id,
      entityIds: {
        submissionId: draft.submissionId,
        assignmentId: draft.assignmentId,
      },
      provider: draft.provider,
      promptVersion: draft.promptVersion,
      payload: {
        failureMessage:
          error instanceof Error ? error.message : "Unknown AI worker error.",
      },
    });
    await updateWritingProviderFailure(draft, error, now);
  }
}

export async function processObjectiveExplanationJob(
  job: PgBoss.Job<ObjectiveExplanationJobPayload>,
  deps: AiFeedbackJobDeps,
): Promise<void> {
  const parsedPayload = objectiveExplanationJobPayloadSchema.safeParse(job.data);

  if (!parsedPayload.success) {
    const handled = await markMalformedObjectivePayloadFailed(
      job.data,
      parsedPayload.error,
      deps.now?.() ?? new Date(),
    );

    if (handled) {
      return;
    }

    throw parsedPayload.error;
  }

  const payload = parsedPayload.data as ObjectiveExplanationJobPayload;
  const explanation = await prisma.aiObjectiveExplanation.findUnique({
    where: { id: payload.explanationId },
    select: {
      id: true,
      requesterId: true,
      submissionId: true,
      assignmentId: true,
      promptVersion: true,
      provider: true,
      routeKey: true,
      status: true,
      retryCount: true,
      deletedAt: true,
    },
  });

  if (!explanation || explanation.deletedAt || !shouldProcess(explanation.status)) {
    return;
  }

  const now = deps.now?.() ?? new Date();

  const runningTransition = await prisma.aiObjectiveExplanation.updateMany({
    where: {
      id: explanation.id,
      status: explanation.status,
      deletedAt: null,
    },
    data: {
      status: "running",
      lastAttemptAt: now,
      nextRetryAt: null,
      failureCode: null,
      failureMessage: null,
    },
  });

  if (runningTransition.count === 0) {
    return;
  }

  try {
    const builtPrompt = buildObjectiveExplanationPrompt(
      payload.harnessInput.promptInput,
    );
    const providerResult = await getProviderRouter(deps).generate(
      builtPrompt.request,
    );
    const harnessResult = evaluateAiFeedbackHarness({
      ...payload.harnessInput,
      providerOutput: providerResult.rawText,
      routeKey: providerResult.routeKey,
    });
    const parsed = parseObjectiveExplanationOutput(providerResult.rawText, {
      deterministicResult: payload.harnessInput.promptInput.deterministicResult,
    });
    const completed = parsed.status === "completed";
    const status =
      harnessResult.status === "accepted" ? "completed" : harnessResult.status;

    await prisma.aiObjectiveExplanation.updateMany({
      where: {
        id: explanation.id,
        status: "running",
        deletedAt: null,
      },
      data: {
        status,
        model: providerResult.model,
        ...(completed
          ? {
              generatedExplanation: toJsonObject(parsed.explanation),
            }
          : {}),
        failureCode: status === "completed" ? null : harnessResult.reasonCode,
        failureMessage:
          status === "completed" ? null : failureMessage(harnessResult.validationErrors),
        nextRetryAt: null,
        lastAttemptAt: now,
      },
    });
    await recordAiFeedbackAudit({
      actorId: explanation.requesterId,
      action:
        status === "completed"
          ? AI_FEEDBACK_AUDIT_ACTIONS.explanationGenerated
          : AI_FEEDBACK_AUDIT_ACTIONS.explanationFailed,
      entity: "ai_objective_explanation",
      entityId: explanation.id,
      entityIds: {
        submissionId: explanation.submissionId,
        assignmentId: explanation.assignmentId,
      },
      routeKey: explanation.routeKey,
      provider: explanation.provider,
      model: providerResult.model,
      promptVersion: explanation.promptVersion,
      payload: {
        status,
        reasonCode: harnessResult.reasonCode,
        validationErrors: harnessResult.validationErrors,
        providerOutput: providerResult.rawText,
        promptInput: payload.harnessInput.promptInput,
      },
    });
  } catch (error) {
    logger.error(
      { err: error, explanationId: explanation.id },
      "AI objective explanation generation failed",
    );
    await recordAiFeedbackAudit({
      actorId: explanation.requesterId,
      action: AI_FEEDBACK_AUDIT_ACTIONS.explanationFailed,
      entity: "ai_objective_explanation",
      entityId: explanation.id,
      entityIds: {
        submissionId: explanation.submissionId,
        assignmentId: explanation.assignmentId,
      },
      routeKey: explanation.routeKey,
      provider: explanation.provider,
      promptVersion: explanation.promptVersion,
      payload: {
        failureMessage:
          error instanceof Error ? error.message : "Unknown AI worker error.",
      },
    });
    await updateObjectiveProviderFailure(explanation, error, now);
  }
}
