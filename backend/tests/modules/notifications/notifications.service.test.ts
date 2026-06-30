/**
 * File: tests/modules/notifications/notifications.service.test.ts
 * Purpose: Validate admin notification recovery workflows.
 * Why: Resend must make dead-lettered notifications eligible for delivery again.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/prisma/client.js", () => ({
  prisma: {
    notification: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));

const prismaModule = await import("../../../src/prisma/client.js");
const prismaTypes = await import("../../../src/prisma/index.js");
const prisma = vi.mocked(prismaModule.prisma, true);
const { UserRole } = prismaTypes;

const { getNotificationById, resendNotification } = await import(
  "../../../src/modules/notifications/notifications.service.js"
);

describe("notifications.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resets retry metadata for admin resend", async () => {
    prisma.notification.findFirst.mockResolvedValueOnce({
      id: "7f6c9f72-1e95-4f36-8f06-0f0a9ed0b1c2",
      status: "dead_letter",
      deletedAt: null,
    });
    prisma.notification.update.mockResolvedValueOnce({
      id: "7f6c9f72-1e95-4f36-8f06-0f0a9ed0b1c2",
      status: "queued",
      attemptCount: 0,
      failureReason: null,
      deadLetteredAt: null,
      nextAttemptAt: null,
      lastAttemptAt: null,
    });

    const result = await resendNotification({
      notificationId: "7f6c9f72-1e95-4f36-8f06-0f0a9ed0b1c2",
    });

    expect(prisma.notification.findFirst).toHaveBeenCalledWith({
      where: {
        id: "7f6c9f72-1e95-4f36-8f06-0f0a9ed0b1c2",
        deletedAt: null,
      },
    });
    expect(prisma.notification.update).toHaveBeenCalledWith({
      where: { id: "7f6c9f72-1e95-4f36-8f06-0f0a9ed0b1c2" },
      data: {
        attemptCount: 0,
        deadLetteredAt: null,
        failureReason: null,
        lastAttemptAt: null,
        nextAttemptAt: null,
        status: "queued",
      },
    });
    expect(result.status).toBe("queued");
  });

  it("rejects resend for missing notifications", async () => {
    prisma.notification.findFirst.mockResolvedValueOnce(null);

    await expect(
      resendNotification({
        notificationId: "7f6c9f72-1e95-4f36-8f06-0f0a9ed0b1c2",
      }),
    ).rejects.toMatchObject({
      statusCode: 404,
    });

    expect(prisma.notification.update).not.toHaveBeenCalled();
  });

  it("lets admins inspect notification failure details by id", async () => {
    prisma.notification.findFirst.mockResolvedValueOnce({
      id: "7f6c9f72-1e95-4f36-8f06-0f0a9ed0b1c2",
      userId: "8f6c9f72-1e95-4f36-8f06-0f0a9ed0b1c3",
      status: "dead_letter",
      failureReason: "mailbox unavailable",
      deletedAt: null,
    });

    const result = await getNotificationById(
      { notificationId: "7f6c9f72-1e95-4f36-8f06-0f0a9ed0b1c2" },
      {
        id: "9f6c9f72-1e95-4f36-8f06-0f0a9ed0b1c4",
        role: UserRole.admin,
      },
    );

    expect(prisma.notification.findFirst).toHaveBeenCalledWith({
      where: {
        id: "7f6c9f72-1e95-4f36-8f06-0f0a9ed0b1c2",
        deletedAt: null,
      },
    });
    expect(result.failureReason).toBe("mailbox unavailable");
  });
});
