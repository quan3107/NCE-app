/**
 * File: src/jobs/cleanupJob.ts
 * Purpose: Run idempotent retention cleanup for expired sessions and stale notification metadata.
 * Why: Scheduled maintenance must perform real bounded cleanup with audit-friendly counts.
 */
import PgBoss from "pg-boss";

import { config } from "../config/env.js";
import { logger } from "../config/logger.js";
import { buildExpiredUnusableSessionWhere } from "../modules/auth/auth.sessions.js";
import { writeAuditLogSafely } from "../modules/audit-logs/audit-logs.service.js";
import { NotificationStatus, Prisma } from "../prisma/index.js";
import { prisma } from "../prisma/client.js";
import {
  logBatchLimitIfReached,
  scrubNotificationMetadataInBatches,
  softDeleteExpiredAuthSessionsInBatches,
  type CleanupBatchLimits,
} from "./cleanupRetentionBatches.js";
import { withServiceRoleJobHandler } from "./serviceRoleJobHandler.js";

export const CLEANUP_JOB_NAME = "cleanup.retention";
const CLEANUP_JOB_CRON = "17 3 * * *";

export type CleanupJobMode = "dry-run" | "execute";

export type CleanupRetentionPolicy = CleanupBatchLimits & {
  authSessionRetentionDays: number;
  notificationMetadataRetentionDays: number;
};

export type CleanupJobResult = {
  mode: CleanupJobMode;
  cutoffs: {
    authSessions: Date;
    notificationMetadata: Date;
  };
  counts: {
    authSessions: number;
    notificationMetadata: number;
  };
  limits: {
    batchSize: number;
    maxBatches: number;
  };
  batchCounts: {
    authSessions: number;
    notificationMetadata: number;
  };
  reachedBatchLimit: {
    authSessions: boolean;
    notificationMetadata: boolean;
  };
};

type CleanupJobOptions = {
  mode?: CleanupJobMode;
  now?: () => Date;
  retentionPolicy?: Partial<CleanupRetentionPolicy>;
};

type CleanupJobDeps = Omit<CleanupJobOptions, "mode">;

function daysBefore(now: Date, days: number): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

function resolveRetentionPolicy(
  override?: Partial<CleanupRetentionPolicy>,
): CleanupRetentionPolicy {
  return {
    authSessionRetentionDays:
      override?.authSessionRetentionDays ??
      config.cleanupRetention.authSessionRetentionDays,
    notificationMetadataRetentionDays:
      override?.notificationMetadataRetentionDays ??
      config.cleanupRetention.notificationMetadataRetentionDays,
    batchSize: override?.batchSize ?? config.cleanupRetention.batchSize,
    maxBatches: override?.maxBatches ?? config.cleanupRetention.maxBatches,
  };
}

function buildStaleNotificationMetadataWhere(
  cutoff: Date,
): Prisma.NotificationWhereInput {
  return {
    deletedAt: null,
    status: {
      in: [NotificationStatus.failed, NotificationStatus.dead_letter],
    },
    AND: [
      {
        OR: [
          { deadLetteredAt: { lte: cutoff } },
          { updatedAt: { lte: cutoff } },
        ],
      },
      {
        OR: [
          { failureReason: { not: null } },
          { deadLetteredAt: { not: null } },
          { nextAttemptAt: { not: null } },
        ],
      },
    ],
  };
}

export async function runCleanupRetentionJob(
  options: CleanupJobOptions = {},
): Promise<CleanupJobResult> {
  const mode = options.mode ?? "execute";
  const now = options.now?.() ?? new Date();
  const retentionPolicy = resolveRetentionPolicy(options.retentionPolicy);
  const authSessionCutoff = daysBefore(
    now,
    retentionPolicy.authSessionRetentionDays,
  );
  const notificationMetadataCutoff = daysBefore(
    now,
    retentionPolicy.notificationMetadataRetentionDays,
  );
  const authSessionWhere = buildExpiredUnusableSessionWhere(authSessionCutoff);
  const notificationMetadataWhere = buildStaleNotificationMetadataWhere(
    notificationMetadataCutoff,
  );

  if (mode === "dry-run") {
    const [authSessions, notificationMetadata] = await Promise.all([
      prisma.authSession.count({ where: authSessionWhere }),
      prisma.notification.count({ where: notificationMetadataWhere }),
    ]);

    logger.info(
      {
        event: "cleanup_retention_dry_run",
        auth_sessions: authSessions,
        notification_metadata: notificationMetadata,
        auth_session_cutoff: authSessionCutoff.toISOString(),
        notification_metadata_cutoff: notificationMetadataCutoff.toISOString(),
      },
      "Cleanup retention dry-run completed",
    );

    return {
      mode,
      cutoffs: {
        authSessions: authSessionCutoff,
        notificationMetadata: notificationMetadataCutoff,
      },
      counts: {
        authSessions,
        notificationMetadata,
      },
      limits: {
        batchSize: retentionPolicy.batchSize,
        maxBatches: retentionPolicy.maxBatches,
      },
      batchCounts: {
        authSessions: 0,
        notificationMetadata: 0,
      },
      reachedBatchLimit: {
        authSessions: false,
        notificationMetadata: false,
      },
    };
  }

  const authSessionResult = await softDeleteExpiredAuthSessionsInBatches(
    authSessionWhere,
    now,
    retentionPolicy,
  );
  const notificationMetadataResult = await scrubNotificationMetadataInBatches(
    notificationMetadataWhere,
    retentionPolicy,
  );
  logBatchLimitIfReached(
    "auth_sessions",
    authSessionResult,
    retentionPolicy,
  );
  logBatchLimitIfReached(
    "notification_metadata",
    notificationMetadataResult,
    retentionPolicy,
  );

  const counts = {
    authSessions: authSessionResult.count,
    notificationMetadata: notificationMetadataResult.count,
  };
  const batchCounts = {
    authSessions: authSessionResult.batches,
    notificationMetadata: notificationMetadataResult.batches,
  };
  const reachedBatchLimit = {
    authSessions: authSessionResult.reachedLimit,
    notificationMetadata: notificationMetadataResult.reachedLimit,
  };

  logger.info(
    {
      event: "cleanup_retention_executed",
      auth_sessions: counts.authSessions,
      notification_metadata: counts.notificationMetadata,
      auth_session_batches: batchCounts.authSessions,
      notification_metadata_batches: batchCounts.notificationMetadata,
      batch_size: retentionPolicy.batchSize,
      max_batches: retentionPolicy.maxBatches,
      auth_session_batch_limit_reached: reachedBatchLimit.authSessions,
      notification_metadata_batch_limit_reached:
        reachedBatchLimit.notificationMetadata,
      auth_session_cutoff: authSessionCutoff.toISOString(),
      notification_metadata_cutoff: notificationMetadataCutoff.toISOString(),
    },
    "Cleanup retention executed",
  );

  await writeAuditLogSafely({
    actorId: null,
    action: "cleanup.retention_executed",
    entity: "maintenance_job",
    entityId: "cleanup-retention",
    diff: {
      authSessions: counts.authSessions,
      notificationMetadata: counts.notificationMetadata,
      authSessionBatches: batchCounts.authSessions,
      notificationMetadataBatches: batchCounts.notificationMetadata,
      batchSize: retentionPolicy.batchSize,
      maxBatches: retentionPolicy.maxBatches,
      authSessionBatchLimitReached: reachedBatchLimit.authSessions,
      notificationMetadataBatchLimitReached:
        reachedBatchLimit.notificationMetadata,
      authSessionCutoff: authSessionCutoff.toISOString(),
      notificationMetadataCutoff: notificationMetadataCutoff.toISOString(),
    },
  });

  return {
    mode,
    cutoffs: {
      authSessions: authSessionCutoff,
      notificationMetadata: notificationMetadataCutoff,
    },
    counts,
    limits: {
      batchSize: retentionPolicy.batchSize,
      maxBatches: retentionPolicy.maxBatches,
    },
    batchCounts,
    reachedBatchLimit,
  };
}

export async function handleCleanupJob(
  _jobOrJobs?: PgBoss.Job<unknown> | PgBoss.Job<unknown>[],
  deps: CleanupJobDeps = {},
): Promise<void> {
  await runCleanupRetentionJob({
    ...deps,
    mode: "execute",
  });
}

export async function registerCleanupJobs(boss: PgBoss): Promise<void> {
  await boss.createQueue(CLEANUP_JOB_NAME);
  await boss.work(
    CLEANUP_JOB_NAME,
    withServiceRoleJobHandler(handleCleanupJob),
  );
  await boss.schedule(CLEANUP_JOB_NAME, CLEANUP_JOB_CRON);

  logger.info("Cleanup jobs registered");
}

export async function purgeExpiredSessions(): Promise<CleanupJobResult> {
  return runCleanupRetentionJob({ mode: "execute" });
}

export async function purgeSoftDeletedEntities(): Promise<CleanupJobResult> {
  return runCleanupRetentionJob({ mode: "execute" });
}
