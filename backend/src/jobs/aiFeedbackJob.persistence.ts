/**
 * File: src/jobs/aiFeedbackJob.persistence.ts
 * Purpose: Persist AI feedback job failure and JSON metadata updates.
 * Why: Keeps queue processors focused on workflow orchestration.
 */
import { AiProviderError } from "../modules/ai-feedback/provider.errors.js";
import { prisma } from "../prisma/client.js";
import { Prisma } from "../prisma/index.js";

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
  const nextAttempt = recordRetryCount + 1;
  const delayMs = Math.min(15 * 60_000, 60_000 * 2 ** recordRetryCount);

  return new Date(now.getTime() + delayMs * nextAttempt);
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

export async function updateWritingProviderFailure(
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

export async function updateObjectiveProviderFailure(
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
