/**
 * File: src/jobs/notificationDelivery.ts
 * Purpose: Deliver queued notifications through in-app or email channels.
 * Why: Separates delivery concerns from scheduling and reminder logic.
 */
import { logger } from "../config/logger.js";
import { resolveNotificationTypeEnabledForUsers } from "../modules/notification-preferences/notification-preferences.service.js";
import { prisma } from "../prisma/client.js";
import { sendNotificationEmail } from "../utils/emailClient.js";

const DELIVERY_BATCH_SIZE = 50;

const EMAIL_SUBJECTS: Record<string, string> = {
  due_soon: "Assignment due soon",
  graded: "Assignment graded",
  new_submission: "New student submission",
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
          role: true,
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

  const teacherPreferenceCache = new Map<string, boolean>();

  for (const notification of queuedNotifications) {
    try {
      if (notification.user.role === "teacher") {
        const cacheKey = `${notification.userId}:${notification.type}`;
        let enabled = teacherPreferenceCache.get(cacheKey);
        if (enabled === undefined) {
          const enabledMap = await resolveNotificationTypeEnabledForUsers({
            role: "teacher",
            type: notification.type,
            userIds: [notification.userId],
          });
          enabled = enabledMap.get(notification.userId) ?? false;
          teacherPreferenceCache.set(cacheKey, enabled);
        }

        if (!enabled) {
          logger.info(
            {
              event: "notification_delivery_suppressed_by_preference",
              notification_id: notification.id,
              user_id: notification.userId,
              type: notification.type,
            },
            "Queued notification delivery suppressed because preference is disabled",
          );
          await prisma.notification.update({
            where: { id: notification.id },
            data: {
              status: "failed",
            },
          });
          continue;
        }
      }

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
          toName: notification.user.fullName,
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
