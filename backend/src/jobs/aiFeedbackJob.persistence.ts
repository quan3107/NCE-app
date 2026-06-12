/**
 * File: src/jobs/aiFeedbackJob.persistence.ts
 * Purpose: Persist AI feedback job failure and JSON metadata updates.
 * Why: Keeps queue processors focused on workflow orchestration.
 */
import { AiProviderError } from "../modules/ai-feedback/provider.errors.js";
import { prisma } from "../prisma/client.js";
import { Prisma } from "../prisma/index.js";
import { AI_FEEDBACK_JOB_OPTIONS } from "./aiFeedbackJob.types.js";

export type QueuedGenerationRecord = {
  id: string;
  status: string;
  retryCount: number;
  deletedAt: Date | null;
};

export function shouldProcess(status: string): boolean {
  return status === "queued" || status === "failed";
}

export function toJsonObject(
  value: Record<string, unknown>,
): Prisma.InputJsonObject {
  return value as Prisma.InputJsonObject;
}

export function toJsonArray(value: unknown[]): Prisma.InputJsonArray {
  return value as Prisma.InputJsonArray;
}

export function failureMessage(errors: string[]): string {
  return errors.join("; ") || "AI feedback generation did not pass validation.";
}

function nextRetryAt(recordRetryCount: number, now: Date): Date {
  const baseDelayMs = AI_FEEDBACK_JOB_OPTIONS.retryDelay * 1000;
  const backoffMultiplier = AI_FEEDBACK_JOB_OPTIONS.retryBackoff
    ? 2 ** recordRetryCount
    : 1;
  const delayMs = Math.min(15 * 60_000, baseDelayMs * backoffMultiplier);

  return new Date(now.getTime() + delayMs);
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

function retryState(
  failure: ReturnType<typeof providerFailure>,
  recordRetryCount: number,
  now: Date,
): {
  nextRetryAt: Date | null;
  shouldRetry: boolean;
  status: "queued" | "failed";
} {
  const nextFailureCount = recordRetryCount + 1;
  const shouldRetry =
    failure.retryable && nextFailureCount <= AI_FEEDBACK_JOB_OPTIONS.retryLimit;

  return {
    status: shouldRetry ? "queued" : "failed",
    nextRetryAt: shouldRetry ? nextRetryAt(recordRetryCount, now) : null,
    shouldRetry,
  };
}

export async function updateWritingProviderFailure(
  draft: QueuedGenerationRecord,
  error: unknown,
  now: Date,
  options: { suppressRetryThrow?: boolean } = {},
): Promise<{ shouldRetry: boolean; updatedCount: number }> {
  const failure = providerFailure(error);
  const retry = retryState(failure, draft.retryCount, now);

  const updated = await prisma.aiFeedbackDraft.updateMany({
    where: {
      id: draft.id,
      status: "running",
      deletedAt: null,
    },
    data: {
      status: retry.status,
      failureCode: failure.code,
      failureMessage: failure.message,
      retryCount: { increment: 1 },
      nextRetryAt: retry.nextRetryAt,
      lastAttemptAt: now,
    },
  });

  if (retry.shouldRetry && updated.count > 0 && !options.suppressRetryThrow) {
    throw error;
  }

  return {
    shouldRetry: retry.shouldRetry,
    updatedCount: updated.count,
  };
}

export async function updateObjectiveProviderFailure(
  explanation: QueuedGenerationRecord,
  error: unknown,
  now: Date,
  options: { suppressRetryThrow?: boolean } = {},
): Promise<{ shouldRetry: boolean; updatedCount: number }> {
  const failure = providerFailure(error);
  const retry = retryState(failure, explanation.retryCount, now);

  const updated = await prisma.aiObjectiveExplanation.updateMany({
    where: {
      id: explanation.id,
      status: "running",
      deletedAt: null,
    },
    data: {
      status: retry.status,
      failureCode: failure.code,
      failureMessage: failure.message,
      retryCount: { increment: 1 },
      nextRetryAt: retry.nextRetryAt,
      lastAttemptAt: now,
    },
  });

  if (retry.shouldRetry && updated.count > 0 && !options.suppressRetryThrow) {
    throw error;
  }

  return {
    shouldRetry: retry.shouldRetry,
    updatedCount: updated.count,
  };
}
