/**
 * File: tests/modules/notification-config/notification-config.service.test.ts
 * Purpose: Validate notification type config lookup and fallback behavior by role.
 * Why: Ensures backend config outages are explicit in logs and do not break consumers.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/prisma/client.js", () => ({
  prisma: {
    notificationTypeConfig: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("../../../src/config/logger.js", () => ({
  logger: {
    warn: vi.fn(),
  },
}));

const prismaModule = await import("../../../src/prisma/client.js");
const loggerModule = await import("../../../src/config/logger.js");
const prisma = vi.mocked(prismaModule.prisma, true);
const logger = vi.mocked(loggerModule.logger, true);

const { getNotificationTypesForRole } = await import(
  "../../../src/modules/notification-config/notification-config.service.js"
);

describe("notification-config.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps role-scoped rows into endpoint payload", async () => {
    prisma.notificationTypeConfig.findMany.mockResolvedValue([
      {
        id: "cfg-1",
        role: "student",
        type: "due_soon",
        label: "Due Soon",
        description: "Soon due",
        category: "assignments",
        defaultEnabled: true,
        enabled: true,
        sortOrder: 2,
        createdAt: new Date("2026-02-09T00:00:00.000Z"),
        updatedAt: new Date("2026-02-09T00:00:00.000Z"),
      },
      {
        id: "cfg-2",
        role: "student",
        type: "graded",
        label: "Graded",
        description: "Recently graded",
        category: "grading",
        defaultEnabled: true,
        enabled: true,
        sortOrder: 3,
        createdAt: new Date("2026-02-09T00:00:00.000Z"),
        updatedAt: new Date("2026-02-09T00:00:00.000Z"),
      },
    ]);

    const payload = await getNotificationTypesForRole("student");

    expect(payload).toEqual({
      types: [
        {
          id: "due_soon",
          label: "Due Soon",
          description: "Soon due",
          category: "assignments",
          default_enabled: true,
          enabled: true,
          sort_order: 2,
        },
        {
          id: "graded",
          label: "Graded",
          description: "Recently graded",
          category: "grading",
          default_enabled: true,
          enabled: true,
          sort_order: 3,
        },
      ],
    });
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("uses fallback and logs explicit reason when rows are missing", async () => {
    prisma.notificationTypeConfig.findMany.mockResolvedValue([]);

    const payload = await getNotificationTypesForRole("teacher");

    expect(payload.types.length).toBeGreaterThan(0);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "notification_types_fallback_used",
        reason: "db_empty_for_role",
        role: "teacher",
      }),
      "Using fallback notification types configuration",
    );
  });

  it("uses fallback and logs explicit reason when query fails", async () => {
    prisma.notificationTypeConfig.findMany.mockRejectedValue(
      new Error("database unavailable"),
    );

    const payload = await getNotificationTypesForRole("admin");

    expect(payload.types.length).toBeGreaterThan(0);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "notification_types_fallback_used",
        reason: "query_failed",
        role: "admin",
      }),
      "Using fallback notification types configuration",
    );
  });
});
