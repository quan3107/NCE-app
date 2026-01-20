/**
 * File: src/modules/notifications/notifications.service.ts
 * Purpose: Implement notification persistence workflows via Prisma.
 * Why: Keeps notification logic isolated from transport-specific code.
 */
import { NotificationChannel, Prisma } from "@prisma/client";

import { prisma } from "../../prisma/client.js";
import { createNotFoundError } from "../../utils/httpError.js";
import {
  createNotificationSchema,
  notificationIdParamsSchema,
} from "./notifications.schema.js";

export async function listNotifications() {
  return prisma.notification.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
  });
}

export async function createNotification(payload: unknown) {
  const data = createNotificationSchema.parse(payload);
  // Default payload to empty object for required JSON column.
  const payloadJson = (data.payload ?? {}) as Prisma.InputJsonObject;

  return prisma.notification.create({
    data: {
      userId: data.userId,
      type: data.template,
      payload: payloadJson,
      channel: data.channel,
      // New notifications start queued until delivery jobs update status.
      status: "queued",
    },
  });
}

export async function getNotificationById(params: unknown) {
  const { notificationId } = notificationIdParamsSchema.parse(params);
  const notification = await prisma.notification.findFirst({
    where: { id: notificationId, deletedAt: null },
  });
  if (!notification) {
    throw createNotFoundError("Notification", notificationId);
  }
  return notification;
}

type EnqueueNotificationInput = {
  userId: string;
  type: string;
  payload: Prisma.InputJsonObject;
  channels: NotificationChannel[];
};

export async function enqueueNotification(
  input: EnqueueNotificationInput,
): Promise<void> {
  const payload = (input.payload ?? {}) as Prisma.InputJsonObject;
  if (input.channels.length === 0) {
    return;
  }

  await prisma.notification.createMany({
    data: input.channels.map((channel) => ({
      userId: input.userId,
      type: input.type,
      payload,
      channel,
      status: "queued",
    })),
  });
}
