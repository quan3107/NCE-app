/**
 * File: src/jobs/cleanupRetentionBatches.ts
 * Purpose: Run bounded ID-batch mutations for cleanup retention work.
 * Why: Cleanup jobs must avoid one-shot production write spikes on stale data backlogs.
 */
import { logger } from "../config/logger.js";
import { Prisma } from "../prisma/index.js";
import { prisma } from "../prisma/client.js";

export type CleanupBatchLimits = {
  batchSize: number;
  maxBatches: number;
};

export type CleanupBatchResult = {
  count: number;
  batches: number;
  reachedLimit: boolean;
};

export async function softDeleteExpiredAuthSessionsInBatches(
  where: Prisma.AuthSessionWhereInput,
  now: Date,
  limits: CleanupBatchLimits,
): Promise<CleanupBatchResult> {
  let count = 0;
  let batches = 0;
  let lastSelectedCount = 0;

  for (let batch = 0; batch < limits.maxBatches; batch += 1) {
    const rows = await prisma.authSession.findMany({
      where,
      select: { id: true },
      orderBy: { id: "asc" },
      take: limits.batchSize,
    });
    lastSelectedCount = rows.length;

    if (rows.length === 0) {
      break;
    }

    batches += 1;

    const result = await prisma.authSession.updateMany({
      where: {
        AND: [
          where,
          {
            id: {
              in: rows.map((row) => row.id),
            },
          },
        ],
      },
      data: {
        deletedAt: now,
      },
    });

    count += result.count;

    if (rows.length < limits.batchSize) {
      break;
    }
  }

  return {
    count,
    batches,
    reachedLimit:
      batches === limits.maxBatches && lastSelectedCount === limits.batchSize,
  };
}

export async function scrubNotificationMetadataInBatches(
  where: Prisma.NotificationWhereInput,
  limits: CleanupBatchLimits,
): Promise<CleanupBatchResult> {
  let count = 0;
  let batches = 0;
  let lastSelectedCount = 0;

  for (let batch = 0; batch < limits.maxBatches; batch += 1) {
    const rows = await prisma.notification.findMany({
      where,
      select: { id: true },
      orderBy: { id: "asc" },
      take: limits.batchSize,
    });
    lastSelectedCount = rows.length;

    if (rows.length === 0) {
      break;
    }

    batches += 1;

    const result = await prisma.notification.updateMany({
      where: {
        AND: [
          where,
          {
            id: {
              in: rows.map((row) => row.id),
            },
          },
        ],
      },
      data: {
        deadLetteredAt: null,
        failureReason: null,
        nextAttemptAt: null,
      },
    });

    count += result.count;

    if (rows.length < limits.batchSize) {
      break;
    }
  }

  return {
    count,
    batches,
    reachedLimit:
      batches === limits.maxBatches && lastSelectedCount === limits.batchSize,
  };
}

export function logBatchLimitIfReached(
  target: "auth_sessions" | "notification_metadata",
  result: CleanupBatchResult,
  limits: CleanupBatchLimits,
): void {
  if (!result.reachedLimit) {
    return;
  }

  logger.warn(
    {
      event: "cleanup_retention_batch_limit_reached",
      target,
      batch_size: limits.batchSize,
      max_batches: limits.maxBatches,
      processed_count: result.count,
    },
    "Cleanup retention batch limit reached",
  );
}
