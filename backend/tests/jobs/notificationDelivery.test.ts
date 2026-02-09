/**
 * File: tests/jobs/notificationDelivery.test.ts
 * Purpose: Verify queued notification delivery respects teacher preference filters.
 * Why: Ensures queued messages are suppressed when teachers disable a notification type.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/prisma/client.js", () => ({
  prisma: {
    notification: {
      findMany: vi.fn(),
      update: vi.fn(),
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
    vi.clearAllMocks();
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
    expect(prisma.notification.update).toHaveBeenCalledWith({
      where: { id: "n-1" },
      data: { status: "failed" },
    });
  });

  it("delivers teacher notification when preference is enabled", async () => {
    prisma.notification.findMany.mockResolvedValue([
      {
        id: "n-2",
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
      new Map([["teacher-1", true]]),
    );

    await handleDeliverQueuedJob();

    expect(sendNotificationEmail).toHaveBeenCalledTimes(1);
    expect(prisma.notification.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "n-2" },
        data: expect.objectContaining({ status: "sent", sentAt: expect.any(Date) }),
      }),
    );
  });
});
