/**
 * File: src/jobs/aiFeedbackJob.processing.ts
 * Purpose: Process queued AI feedback draft and objective explanation jobs.
 * Why: Provider calls, harness validation, and persistence are cohesive worker behavior.
 */
import type PgBoss from "pg-boss";
import { z } from "zod";

import { logger } from "../config/logger.js";
import { evaluateAiFeedbackHarness } from "../modules/ai-feedback/harness/harness.service.js";
import {
  parseObjectiveExplanationOutput,
  parseWritingFeedbackOutput,
} from "../modules/ai-feedback/parser.js";
import { AiProviderError } from "../modules/ai-feedback/provider.errors.js";
import { createAiProviderRouterFromConfig } from "../modules/ai-feedback/provider.factory.js";
import {
  buildIeltsWritingFeedbackPrompt,
  buildObjectiveExplanationPrompt,
} from "../modules/ai-feedback/prompts/index.js";
import { prisma } from "../prisma/client.js";
import { Prisma } from "../prisma/index.js";
import type {
  AiFeedbackJobDeps,
  ObjectiveExplanationJobPayload,
  WritingDraftJobPayload,
} from "./aiFeedbackJob.types.js";

type QueuedGenerationRecord = {
  id: string;
  status: string;
  retryCount: number;
  deletedAt: Date | null;
};

const writingDraftPayloadSchema = z
  .object({
    draftId: z.string().uuid(),
    harnessInput: z
      .object({
        fixtureId: z.string().min(1),
        taskType: z.literal("writing_feedback"),
        promptInput: z.unknown(),
        routeKey: z.string().min(1).optional(),
        allowVisualImageFallback: z.boolean().optional(),
      })
      .passthrough(),
  })
  .strict();

const objectiveExplanationPayloadSchema = z
  .object({
    explanationId: z.string().uuid(),
    harnessInput: z
      .object({
        fixtureId: z.string().min(1),
        taskType: z.literal("objective_explanation"),
        promptInput: z.unknown(),
        routeKey: z.string().min(1).optional(),
      })
      .passthrough(),
  })
  .strict();

function getProviderRouter(deps: AiFeedbackJobDeps) {
  return deps.providerRouter ?? createAiProviderRouterFromConfig();
}

function shouldProcess(status: string): boolean {
  return status === "queued" || status === "failed";
}

function nextRetryAt(recordRetryCount: number, now: Date): Date {
  const nextAttempt = recordRetryCount + 1;
  const delayMs = Math.min(15 * 60_000, 60_000 * 2 ** recordRetryCount);

  return new Date(now.getTime() + delayMs * nextAttempt);
}

function toJsonObject(value: Record<string, unknown>): Prisma.InputJsonObject {
  return value as Prisma.InputJsonObject;
}

function toJsonArray(value: unknown[]): Prisma.InputJsonArray {
  return value as Prisma.InputJsonArray;
}

function failureMessage(errors: string[]): string {
  return errors.join("; ") || "AI feedback generation did not pass validation.";
}

function providerFailure(error: unknown): {
  code: string;
  message: string;
  retryable: boolean;
} {
  if (error instanceof AiProviderError) {
    return {
      code: error.code,
      message: error.message,
      retryable: error.retryable,
    };
  }

  return {
    code: "worker_exception",
    message: error instanceof Error ? error.message : "Unknown AI worker error.",
    retryable: false,
  };
}

async function updateWritingProviderFailure(
  draft: QueuedGenerationRecord,
  error: unknown,
  now: Date,
): Promise<void> {
  const failure = providerFailure(error);

  await prisma.aiFeedbackDraft.update({
    where: { id: draft.id },
    data: {
      status: "failed",
      failureCode: failure.code,
      failureMessage: failure.message,
      retryCount: { increment: 1 },
      nextRetryAt: failure.retryable ? nextRetryAt(draft.retryCount, now) : null,
      lastAttemptAt: now,
    },
  });

  if (failure.retryable) {
    throw error;
  }
}

async function updateObjectiveProviderFailure(
  explanation: QueuedGenerationRecord,
  error: unknown,
  now: Date,
): Promise<void> {
  const failure = providerFailure(error);

  await prisma.aiObjectiveExplanation.update({
    where: { id: explanation.id },
    data: {
      status: "failed",
      failureCode: failure.code,
      failureMessage: failure.message,
      retryCount: { increment: 1 },
      nextRetryAt: failure.retryable
        ? nextRetryAt(explanation.retryCount, now)
        : null,
      lastAttemptAt: now,
    },
  });

  if (failure.retryable) {
    throw error;
  }
}

export async function processWritingDraftJob(
  job: PgBoss.Job<WritingDraftJobPayload>,
  deps: AiFeedbackJobDeps,
): Promise<void> {
  const payload = writingDraftPayloadSchema.parse(
    job.data,
  ) as WritingDraftJobPayload;
  const draft = await prisma.aiFeedbackDraft.findUnique({
    where: { id: payload.draftId },
    select: {
      id: true,
      status: true,
      retryCount: true,
      deletedAt: true,
    },
  });

  if (!draft || draft.deletedAt || !shouldProcess(draft.status)) {
    return;
  }

  const now = deps.now?.() ?? new Date();

  await prisma.aiFeedbackDraft.update({
    where: { id: draft.id },
    data: {
      status: "running",
      lastAttemptAt: now,
      nextRetryAt: null,
      failureCode: null,
      failureMessage: null,
    },
  });

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

    await prisma.aiFeedbackDraft.update({
      where: { id: draft.id },
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
  } catch (error) {
    logger.error(
      { err: error, draftId: draft.id },
      "AI writing draft generation failed",
    );
    await updateWritingProviderFailure(draft, error, now);
  }
}

export async function processObjectiveExplanationJob(
  job: PgBoss.Job<ObjectiveExplanationJobPayload>,
  deps: AiFeedbackJobDeps,
): Promise<void> {
  const payload = objectiveExplanationPayloadSchema.parse(
    job.data,
  ) as ObjectiveExplanationJobPayload;
  const explanation = await prisma.aiObjectiveExplanation.findUnique({
    where: { id: payload.explanationId },
    select: {
      id: true,
      status: true,
      retryCount: true,
      deletedAt: true,
    },
  });

  if (!explanation || explanation.deletedAt || !shouldProcess(explanation.status)) {
    return;
  }

  const now = deps.now?.() ?? new Date();

  await prisma.aiObjectiveExplanation.update({
    where: { id: explanation.id },
    data: {
      status: "running",
      lastAttemptAt: now,
      nextRetryAt: null,
      failureCode: null,
      failureMessage: null,
    },
  });

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

    await prisma.aiObjectiveExplanation.update({
      where: { id: explanation.id },
      data: {
        status,
        routeKey: providerResult.routeKey,
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
  } catch (error) {
    logger.error(
      { err: error, explanationId: explanation.id },
      "AI objective explanation generation failed",
    );
    await updateObjectiveProviderFailure(explanation, error, now);
  }
}
