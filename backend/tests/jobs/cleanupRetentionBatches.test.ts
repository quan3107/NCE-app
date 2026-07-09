/**
 * File: tests/jobs/cleanupRetentionBatches.test.ts
 * Purpose: Verify cleanup retention batch helpers cap production write work.
 * Why: Retention jobs must drain stale backlogs without unbounded updates.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/prisma/client.js", () => ({
  prisma: {
    authSession: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    notification: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock("../../src/config/logger.js", () => ({
  logger: {
    warn: vi.fn(),
  },
}));

const prismaModule = await import("../../src/prisma/client.js");
const loggerModule = await import("../../src/config/logger.js");
const {
  logBatchLimitIfReached,
  softDeleteExpiredAuthSessionsInBatches,
} = await import("../../src/jobs/cleanupRetentionBatches.js");

const prisma = vi.mocked(prismaModule.prisma, true);
const logger = vi.mocked(loggerModule.logger, true);
const fixedNow = new Date("2026-07-08T10:00:00.000Z");
const authCutoff = new Date("2026-06-08T10:00:00.000Z");
const expiredSessionWhere = {
  deletedAt: null,
  OR: [
    { expiresAt: { lte: authCutoff } },
    { revokedAt: { lte: authCutoff } },
    { replacedAt: { lte: authCutoff } },
    { reuseDetectedAt: { lte: authCutoff } },
  ],
};
const limits = { batchSize: 2, maxBatches: 2 };

describe("jobs.cleanupRetentionBatches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("limits execute work to bounded ID batches", async () => {
    prisma.authSession.findMany
      .mockResolvedValueOnce([{ id: "session-1" }, { id: "session-2" }] as never)
      .mockResolvedValueOnce([{ id: "session-3" }, { id: "session-4" }] as never);
    prisma.authSession.updateMany
      .mockResolvedValueOnce({ count: 2 } as never)
      .mockResolvedValueOnce({ count: 2 } as never);

    const result = await softDeleteExpiredAuthSessionsInBatches(
      expiredSessionWhere,
      fixedNow,
      limits,
    );

    expect(result).toEqual({ count: 4, batches: 2, reachedLimit: true });
    expect(prisma.authSession.findMany).toHaveBeenCalledTimes(2);
    expect(prisma.authSession.findMany).toHaveBeenCalledWith({
      where: expiredSessionWhere,
      select: { id: true },
      orderBy: { id: "asc" },
      take: 2,
    });
    expect(prisma.authSession.updateMany).toHaveBeenNthCalledWith(2, {
      where: {
        AND: [
          expiredSessionWhere,
          { id: { in: ["session-3", "session-4"] } },
        ],
      },
      data: {
        deletedAt: fixedNow,
      },
    });
  });

  it("logs when a cleanup batch cap is reached", () => {
    logBatchLimitIfReached("auth_sessions", {
      count: 4,
      batches: 2,
      reachedLimit: true,
    }, limits);

    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "cleanup_retention_batch_limit_reached",
        target: "auth_sessions",
        batch_size: 2,
        max_batches: 2,
      }),
      "Cleanup retention batch limit reached",
    );
  });
});
