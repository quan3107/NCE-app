/**
 * File: src/jobs/notificationDelivery.ts
 * Purpose: Deliver queued notifications through in-app or email channels.
 * Why: Separates delivery concerns from scheduling and reminder logic.
 */
import { logger } from "../config/logger.js";
import { prisma } from "../prisma/client.js";
import { sendNotificationEmail } from "../utils/emailClient.js";

const DELIVERY_BATCH_SIZE = 50;

const EMAIL_SUBJECTS: Record<string, string> = {
  due_soon: "Assignment due soon",
  graded: "Assignment graded",
  weekly_digest: "Weekly assignment digest",
};

export async function handleDeliverQueuedJob(): Promise<void> {
  const queuedNotifications = await prisma.notification.findMany({
    where: {
      status: "queued",
      deletedAt: null,
    },
    include: {
      user: {
        select: {
          email: true,
          fullName: true,
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
    take: DELIVERY_BATCH_SIZE,
  });

  if (queuedNotifications.length === 0) {
    logger.debug("Delivery job found no queued notifications");
    return;
  }

  for (const notification of queuedNotifications) {
    try {
      if (notification.channel === "email") {
        const subject =
          EMAIL_SUBJECTS[notification.type] ?? "Notification update";
        const bodyText = [
          subject,
          "",
          `Recipient: ${notification.user.fullName}`,
          "",
          "Payload:",
          JSON.stringify(notification.payload ?? {}, null, 2),
        ].join("\n");

        if (!notification.user.email) {
          throw new Error("Missing recipient email");
        }

        await sendNotificationEmail({
          to: notification.user.email,
          subject,
          bodyText,
        });
      }

      await prisma.notification.update({
        where: { id: notification.id },
        data: {
          status: "sent",
          sentAt: new Date(),
        },
      });
    } catch (error) {
      logger.error(
        { err: error, notificationId: notification.id },
        "Notification delivery failed",
      );
      await prisma.notification.update({
        where: { id: notification.id },
        data: {
          status: "failed",
        },
      });
    }
  }
}
