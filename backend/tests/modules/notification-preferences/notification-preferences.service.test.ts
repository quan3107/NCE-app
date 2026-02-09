/**
 * File: tests/modules/notification-preferences/notification-preferences.service.test.ts
 * Purpose: Validate user notification preference merge, persistence, and delivery-resolution behavior.
 * Why: Ensures teacher filters are enforced by backend logic before notifications are delivered.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/prisma/client.js", () => ({
  prisma: {
    userNotificationPreference: {
      findMany: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("../../../src/modules/notification-config/notification-config.service.js", () => ({
  getNotificationTypesForRole: vi.fn(),
}));

vi.mock("../../../src/config/logger.js", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

const prismaModule = await import("../../../src/prisma/client.js");
const notificationConfigModule = await import(
  "../../../src/modules/notification-config/notification-config.service.js"
);
const prisma = vi.mocked(prismaModule.prisma, true);
const getNotificationTypesForRole = vi.mocked(
  notificationConfigModule.getNotificationTypesForRole,
  true,
);

const {
  getMyNotificationPreferencesForUser,
  resolveNotificationTypeEnabledForUsers,
  saveMyNotificationPreferencesForUser,
} = await import(
  "../../../src/modules/notification-preferences/notification-preferences.service.js"
);

describe("notification-preferences.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.$transaction.mockImplementation(async (callback: unknown) => {
      if (typeof callback !== "function") {
        return callback;
      }
      return callback({
        userNotificationPreference: {
          upsert: prisma.userNotificationPreference.upsert,
          deleteMany: prisma.userNotificationPreference.deleteMany,
        },
      });
    });
  });

  it("merges role defaults with user overrides", async () => {
    getNotificationTypesForRole.mockResolvedValue({
      types: [
        {
          id: "new_submission",
          label: "New Submission",
          description: "When a student submits new work.",
          category: "grading",
          default_enabled: true,
          enabled: true,
          sort_order: 1,
        },
        {
          id: "reminder",
          label: "Reminder",
          description: "General reminders.",
          category: "general",
          default_enabled: true,
          enabled: true,
          sort_order: 2,
        },
      ],
    });

    prisma.userNotificationPreference.findMany.mockResolvedValue([
      {
        id: "pref-1",
        userId: "teacher-1",
        type: "new_submission",
        enabled: false,
        createdAt: new Date("2026-02-09T00:00:00.000Z"),
        updatedAt: new Date("2026-02-09T00:00:00.000Z"),
      },
    ]);

    const response = await getMyNotificationPreferencesForUser(
      "teacher-1",
      "teacher",
    );

    expect(response.personalized).toBe(true);
    expect(response.types).toEqual([
      expect.objectContaining({ id: "new_submission", enabled: false }),
      expect.objectContaining({ id: "reminder", enabled: true }),
    ]);
  });

  it("stores only non-default overrides when saving preferences", async () => {
    getNotificationTypesForRole.mockResolvedValue({
      types: [
        {
          id: "new_submission",
          label: "New Submission",
          description: "When a student submits new work.",
          category: "grading",
          default_enabled: true,
          enabled: true,
          sort_order: 1,
        },
        {
          id: "weekly_digest",
          label: "Weekly Digest",
          description: "Digest.",
          category: "digest",
          default_enabled: false,
          enabled: true,
          sort_order: 2,
        },
      ],
    });

    prisma.userNotificationPreference.findMany.mockResolvedValue([
      {
        id: "pref-2",
        userId: "teacher-1",
        type: "new_submission",
        enabled: false,
        createdAt: new Date("2026-02-09T00:00:00.000Z"),
        updatedAt: new Date("2026-02-09T00:00:00.000Z"),
      },
    ]);

    await saveMyNotificationPreferencesForUser("teacher-1", "teacher", {
      types: [
        { id: "new_submission", enabled: false },
        { id: "weekly_digest", enabled: false },
      ],
    });

    expect(prisma.userNotificationPreference.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.userNotificationPreference.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId_type: {
            userId: "teacher-1",
            type: "new_submission",
          },
        },
      }),
    );
    expect(prisma.userNotificationPreference.deleteMany).toHaveBeenCalledWith({
      where: {
        userId: "teacher-1",
        type: "weekly_digest",
      },
    });
  });

  it("resolves enabled map using defaults and overrides", async () => {
    getNotificationTypesForRole.mockResolvedValue({
      types: [
        {
          id: "new_submission",
          label: "New Submission",
          description: "When a student submits new work.",
          category: "grading",
          default_enabled: true,
          enabled: true,
          sort_order: 1,
        },
      ],
    });

    prisma.userNotificationPreference.findMany.mockResolvedValue([
      {
        userId: "teacher-2",
        enabled: false,
      },
    ]);

    const result = await resolveNotificationTypeEnabledForUsers({
      role: "teacher",
      type: "new_submission",
      userIds: ["teacher-1", "teacher-2", "teacher-1"],
    });

    expect(result.get("teacher-1")).toBe(true);
    expect(result.get("teacher-2")).toBe(false);
  });

  it("suppresses all users when type is not enabled for role", async () => {
    getNotificationTypesForRole.mockResolvedValue({
      types: [
        {
          id: "weekly_digest",
          label: "Weekly Digest",
          description: "Digest.",
          category: "digest",
          default_enabled: true,
          enabled: true,
          sort_order: 1,
        },
      ],
    });

    const result = await resolveNotificationTypeEnabledForUsers({
      role: "teacher",
      type: "new_submission",
      userIds: ["teacher-1"],
    });

    expect(result.get("teacher-1")).toBe(false);
  });
});
