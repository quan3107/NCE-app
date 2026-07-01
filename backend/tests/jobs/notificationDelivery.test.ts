/**
 * File: tests/jobs/notificationDelivery.test.ts
 * Purpose: Verify queued notification delivery retries, dead-letters, and respects preferences.
 * Why: Ensures notification transport failures are recoverable and suppression is explicit.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/prisma/client.js", () => ({
  prisma: {
    notification: {
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock(
  "../../src/modules/notification-preferences/notification-preferences.service.js",
  () => ({
    resolveNotificationTypeEnabledForUsers: vi.fn(),
  }),
);

vi.mock("../../src/utils/emailClient.js", () => ({
  sendNotificationEmail: vi.fn(),
}));

vi.mock("../../src/config/logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

const prismaModule = await import("../../src/prisma/client.js");
const notificationPreferencesModule = await import(
  "../../src/modules/notification-preferences/notification-preferences.service.js"
);
const emailModule = await import("../../src/utils/emailClient.js");

const prisma = vi.mocked(prismaModule.prisma, true);
const resolveNotificationTypeEnabledForUsers = vi.mocked(
  notificationPreferencesModule.resolveNotificationTypeEnabledForUsers,
  true,
);
const sendNotificationEmail = vi.mocked(emailModule.sendNotificationEmail, true);

const { handleDeliverQueuedJob } = await import(
  "../../src/jobs/notificationDelivery.js"
);

describe("jobs.notificationDelivery", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-30T10:00:00.000Z"));
    prisma.notification.updateMany.mockImplementation(async (args) => {
      if (args.data.status === "delivery_unknown") {
        return { count: 0 };
      }
      return { count: 1 };
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("suppresses teacher notification delivery when preference is disabled", async () => {
    prisma.notification.findMany.mockResolvedValue([
      {
        id: "n-1",
        userId: "teacher-1",
        type: "new_submission",
        channel: "email",
        payload: {},
        user: {
          role: "teacher",
          email: "teacher@example.com",
          fullName: "Teacher One",
        },
      },
    ]);
    resolveNotificationTypeEnabledForUsers.mockResolvedValue(
      new Map([["teacher-1", false]]),
    );

    await handleDeliverQueuedJob();

    expect(sendNotificationEmail).not.toHaveBeenCalled();
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: {
        id: "n-1",
        deletedAt: null,
        OR: [
          {
            status: "queued",
            OR: [
              { nextAttemptAt: null },
              {
                nextAttemptAt: {
                  lte: new Date("2026-06-30T10:00:00.000Z"),
                },
              },
            ],
          },
        ],
      },
      data: {
        lastAttemptAt: new Date("2026-06-30T10:00:00.000Z"),
        status: "sending",
      },
    });
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { id: "n-1", deletedAt: null, status: "sending" },
      data: {
        failureReason: "suppressed_by_preference",
        lastAttemptAt: new Date("2026-06-30T10:00:00.000Z"),
        status: "suppressed",
      },
    });
  });

  it("recovers stale sending notifications into an unknown delivery state", async () => {
    prisma.notification.findMany.mockResolvedValue([]);

    await handleDeliverQueuedJob();

    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: {
        status: "sending",
        deletedAt: null,
        lastAttemptAt: {
          lte: new Date("2026-06-30T09:45:00.000Z"),
        },
      },
      data: {
        failureReason: "delivery_state_unknown",
        nextAttemptAt: null,
        status: "delivery_unknown",
      },
    });
  });

  it("only fetches queued notifications that are due for delivery", async () => {
    prisma.notification.findMany.mockResolvedValue([]);

    await handleDeliverQueuedJob();

    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: "queued",
          deletedAt: null,
          OR: [
            { nextAttemptAt: null },
            { nextAttemptAt: { lte: new Date("2026-06-30T10:00:00.000Z") } },
          ],
        },
      }),
    );
  });

  it("delivers teacher notification when preference is enabled", async () => {
    prisma.notification.findMany.mockResolvedValue([
      {
        id: "n-2",
        userId: "teacher-1",
        type: "new_submission",
        attemptCount: 1,
        maxAttempts: 3,
        channel: "email",
        payload: {},
        user: {
          role: "teacher",
          email: "teacher@example.com",
          fullName: "Teacher One",
        },
      },
    ]);
    resolveNotificationTypeEnabledForUsers.mockResolvedValue(
      new Map([["teacher-1", true]]),
    );

    await handleDeliverQueuedJob();

    expect(sendNotificationEmail).toHaveBeenCalledTimes(1);
    expect(prisma.notification.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "n-2", deletedAt: null, status: "sending" },
        data: expect.objectContaining({
          failureReason: null,
          lastAttemptAt: expect.any(Date),
          nextAttemptAt: null,
          status: "sent",
          sentAt: expect.any(Date),
        }),
      }),
    );
  });

  it("does not schedule a retry when sent-status persistence fails after email delivery", async () => {
    prisma.notification.findMany.mockResolvedValue([
      {
        id: "n-5",
        userId: "student-1",
        type: "due_soon",
        attemptCount: 0,
        maxAttempts: 3,
        channel: "email",
        payload: {},
        user: {
          role: "student",
          email: "student@example.com",
          fullName: "Student One",
        },
      },
    ]);
    prisma.notification.updateMany.mockImplementation(async (args) => {
      if (args.data.status === "sent") {
        throw new Error("database unavailable");
      }
      return { count: 1 };
    });

    await handleDeliverQueuedJob();

    expect(sendNotificationEmail).toHaveBeenCalledTimes(1);
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: {
        id: "n-5",
        deletedAt: null,
        OR: [
          {
            status: "queued",
            OR: [
              { nextAttemptAt: null },
              {
                nextAttemptAt: {
                  lte: new Date("2026-06-30T10:00:00.000Z"),
                },
              },
            ],
          },
        ],
      },
      data: {
        lastAttemptAt: new Date("2026-06-30T10:00:00.000Z"),
        status: "sending",
      },
    });
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { id: "n-5", deletedAt: null, status: "sending" },
      data: expect.objectContaining({ status: "sent" }),
    });
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { id: "n-5", deletedAt: null, status: "sending" },
      data: {
        failureReason: "delivery_state_unknown",
        nextAttemptAt: null,
        status: "delivery_unknown",
      },
    });
    expect(prisma.notification.update).not.toHaveBeenCalled();
  });

  it("skips transport when another worker already claimed the notification", async () => {
    prisma.notification.findMany.mockResolvedValue([
      {
        id: "n-7",
        userId: "student-1",
        type: "due_soon",
        attemptCount: 0,
        maxAttempts: 3,
        channel: "email",
        payload: {},
        user: {
          role: "student",
          email: "student@example.com",
          fullName: "Student One",
        },
      },
    ]);
    prisma.notification.updateMany.mockResolvedValue({ count: 0 });

    await handleDeliverQueuedJob();

    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: {
        id: "n-7",
        deletedAt: null,
        OR: [
          {
            status: "queued",
            OR: [
              { nextAttemptAt: null },
              {
                nextAttemptAt: {
                  lte: new Date("2026-06-30T10:00:00.000Z"),
                },
              },
            ],
          },
        ],
      },
      data: {
        lastAttemptAt: new Date("2026-06-30T10:00:00.000Z"),
        status: "sending",
      },
    });
    expect(sendNotificationEmail).not.toHaveBeenCalled();
    expect(prisma.notification.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "sent" }),
      }),
    );
  });

  it("schedules retry with redacted failure reason after transient delivery failure", async () => {
    prisma.notification.findMany.mockResolvedValue([
      {
        id: "n-3",
        userId: "student-1",
        type: "due_soon",
        attemptCount: 1,
        maxAttempts: 3,
        channel: "email",
        payload: {},
        user: {
          role: "student",
          email: "student@example.com",
          fullName: "Student One",
        },
      },
    ]);
    sendNotificationEmail.mockRejectedValue(
      new Error("SMTP password abc123 failed"),
    );

    await handleDeliverQueuedJob();

    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { id: "n-3", deletedAt: null, status: "sending" },
      data: {
        attemptCount: { increment: 1 },
        failureReason: "SMTP password [redacted] failed",
        lastAttemptAt: new Date("2026-06-30T10:00:00.000Z"),
        nextAttemptAt: new Date("2026-06-30T10:04:00.000Z"),
        status: "queued",
      },
    });
  });

  it("dead-letters after the final delivery failure", async () => {
    prisma.notification.findMany.mockResolvedValue([
      {
        id: "n-4",
        userId: "student-1",
        type: "due_soon",
        attemptCount: 2,
        maxAttempts: 3,
        channel: "email",
        payload: {},
        user: {
          role: "student",
          email: "student@example.com",
          fullName: "Student One",
        },
      },
    ]);
    sendNotificationEmail.mockRejectedValue(new Error("mailbox unavailable"));

    await handleDeliverQueuedJob();

    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { id: "n-4", deletedAt: null, status: "sending" },
      data: {
        attemptCount: { increment: 1 },
        deadLetteredAt: new Date("2026-06-30T10:00:00.000Z"),
        failureReason: "mailbox unavailable",
        lastAttemptAt: new Date("2026-06-30T10:00:00.000Z"),
        nextAttemptAt: null,
        status: "dead_letter",
      },
    });
  });

  it("redacts bearer authorization values from stored failure reasons", async () => {
    prisma.notification.findMany.mockResolvedValue([
      {
        id: "n-6",
        userId: "student-1",
        type: "due_soon",
        attemptCount: 0,
        maxAttempts: 3,
        channel: "email",
        payload: {},
        user: {
          role: "student",
          email: "student@example.com",
          fullName: "Student One",
        },
      },
    ]);
    sendNotificationEmail.mockRejectedValue(
      new Error("Authorization: Bearer real-token"),
    );

    await handleDeliverQueuedJob();

    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { id: "n-6", deletedAt: null, status: "sending" },
      data: expect.objectContaining({
        failureReason: "Authorization: [redacted]",
      }),
    });
  });
});
