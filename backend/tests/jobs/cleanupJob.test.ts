/**
 * File: tests/jobs/cleanupJob.test.ts
 * Purpose: Verify cleanup retention jobs report, execute, audit, and schedule safely.
 * Why: Retention work must be idempotent and visible before it can run in production.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/prisma/client.js", () => ({
  prisma: {
    authSession: {
      count: vi.fn(),
      updateMany: vi.fn(),
    },
    notification: {
      count: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock("../../src/modules/audit-logs/audit-logs.service.js", () => ({
  writeAuditLogSafely: vi.fn(),
}));

vi.mock("../../src/config/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

const prismaModule = await import("../../src/prisma/client.js");
const auditModule = await import(
  "../../src/modules/audit-logs/audit-logs.service.js"
);
const loggerModule = await import("../../src/config/logger.js");

const prisma = vi.mocked(prismaModule.prisma, true);
const writeAuditLogSafely = vi.mocked(auditModule.writeAuditLogSafely);
const logger = vi.mocked(loggerModule.logger, true);

const {
  CLEANUP_JOB_NAME,
  handleCleanupJob,
  registerCleanupJobs,
  runCleanupRetentionJob,
} = await import("../../src/jobs/cleanupJob.js");

const fixedNow = new Date("2026-07-08T10:00:00.000Z");
const authCutoff = new Date("2026-06-08T10:00:00.000Z");
const notificationCutoff = new Date("2026-04-09T10:00:00.000Z");
const retentionPolicy = {
  authSessionRetentionDays: 30,
  notificationMetadataRetentionDays: 90,
};

const expiredSessionWhere = {
  deletedAt: null,
  OR: [
    { expiresAt: { lte: authCutoff } },
    { revokedAt: { lte: authCutoff } },
    { replacedAt: { lte: authCutoff } },
    { reuseDetectedAt: { lte: authCutoff } },
  ],
};

const staleNotificationMetadataWhere = {
  deletedAt: null,
  status: { in: ["failed", "dead_letter"] },
  AND: [
    {
      OR: [
        { deadLetteredAt: { lte: notificationCutoff } },
        { updatedAt: { lte: notificationCutoff } },
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

describe("jobs.cleanupJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.authSession.count.mockResolvedValue(2 as never);
    prisma.notification.count.mockResolvedValue(3 as never);
    prisma.authSession.updateMany.mockResolvedValue({ count: 2 } as never);
    prisma.notification.updateMany.mockResolvedValue({ count: 3 } as never);
  });

  it("reports dry-run counts without destructive writes", async () => {
    const result = await runCleanupRetentionJob({
      mode: "dry-run",
      now: () => fixedNow,
      retentionPolicy,
    });

    expect(result).toEqual({
      mode: "dry-run",
      cutoffs: {
        authSessions: authCutoff,
        notificationMetadata: notificationCutoff,
      },
      counts: {
        authSessions: 2,
        notificationMetadata: 3,
      },
    });
    expect(prisma.authSession.count).toHaveBeenCalledWith({
      where: expiredSessionWhere,
    });
    expect(prisma.notification.count).toHaveBeenCalledWith({
      where: staleNotificationMetadataWhere,
    });
    expect(prisma.authSession.updateMany).not.toHaveBeenCalled();
    expect(prisma.notification.updateMany).not.toHaveBeenCalled();
    expect(writeAuditLogSafely).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "cleanup_retention_dry_run",
        auth_sessions: 2,
        notification_metadata: 3,
      }),
      "Cleanup retention dry-run completed",
    );
  });

  it("soft-deletes expired unusable sessions and clears stale notification metadata", async () => {
    const result = await runCleanupRetentionJob({
      mode: "execute",
      now: () => fixedNow,
      retentionPolicy,
    });

    expect(result.counts).toEqual({
      authSessions: 2,
      notificationMetadata: 3,
    });
    expect(prisma.authSession.updateMany).toHaveBeenCalledWith({
      where: expiredSessionWhere,
      data: {
        deletedAt: fixedNow,
      },
    });
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: staleNotificationMetadataWhere,
      data: {
        deadLetteredAt: null,
        failureReason: null,
        nextAttemptAt: null,
      },
    });
    expect(writeAuditLogSafely).toHaveBeenCalledWith({
      actorId: null,
      action: "cleanup.retention_executed",
      entity: "maintenance_job",
      entityId: "cleanup-retention",
      diff: {
        authSessions: 2,
        notificationMetadata: 3,
        authSessionCutoff: authCutoff.toISOString(),
        notificationMetadataCutoff: notificationCutoff.toISOString(),
      },
    });
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "cleanup_retention_executed",
        auth_sessions: 2,
        notification_metadata: 3,
      }),
      "Cleanup retention executed",
    );
  });

  it("returns executed counts from mutations so repeated runs become idempotent", async () => {
    prisma.authSession.count.mockResolvedValue(4 as never);
    prisma.notification.count.mockResolvedValue(5 as never);
    prisma.authSession.updateMany.mockResolvedValue({ count: 1 } as never);
    prisma.notification.updateMany.mockResolvedValue({ count: 0 } as never);

    const result = await runCleanupRetentionJob({
      mode: "execute",
      now: () => fixedNow,
      retentionPolicy,
    });

    expect(result.counts).toEqual({
      authSessions: 1,
      notificationMetadata: 0,
    });
    expect(writeAuditLogSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        diff: expect.objectContaining({
          authSessions: 1,
          notificationMetadata: 0,
        }),
      }),
    );
  });

  it("uses execute mode from the pg-boss handler", async () => {
    await handleCleanupJob([], {
      now: () => fixedNow,
      retentionPolicy,
    });

    expect(prisma.authSession.updateMany).toHaveBeenCalled();
    expect(prisma.notification.updateMany).toHaveBeenCalled();
  });

  it("registers a scheduled cleanup queue", async () => {
    const boss = {
      createQueue: vi.fn(),
      work: vi.fn(),
      schedule: vi.fn(),
    };

    await registerCleanupJobs(boss as never);

    expect(boss.createQueue).toHaveBeenCalledWith(CLEANUP_JOB_NAME);
    expect(boss.work).toHaveBeenCalledWith(CLEANUP_JOB_NAME, handleCleanupJob);
    expect(boss.schedule).toHaveBeenCalledWith(CLEANUP_JOB_NAME, "17 3 * * *");
  });
});
