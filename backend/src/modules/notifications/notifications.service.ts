/**
 * File: src/modules/notifications/notifications.service.ts
 * Purpose: Implement notification persistence workflows via Prisma.
 * Why: Keeps notification logic isolated from transport-specific code.
 */
import { NotificationChannel, Prisma, UserRole } from "@prisma/client";

import { prisma } from "../../prisma/client.js";
import {
  createHttpError,
  createNotFoundError,
} from "../../utils/httpError.js";
import {
  createNotificationSchema,
  markNotificationsReadSchema,
  notificationIdParamsSchema,
} from "./notifications.schema.js";

type NotificationActor = {
  id: string;
  role: UserRole;
};

export async function listNotifications(actor: NotificationActor) {
  return prisma.notification.findMany({
    where: { deletedAt: null, userId: actor.id },
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

export async function getNotificationById(
  params: unknown,
  actor: NotificationActor,
) {
  const { notificationId } = notificationIdParamsSchema.parse(params);
  const notification = await prisma.notification.findFirst({
    where: { id: notificationId, deletedAt: null, userId: actor.id },
  });
  if (!notification) {
    throw createNotFoundError("Notification", notificationId);
  }
  return notification;
}

export async function markNotificationsRead(
  payload: unknown,
  actor: NotificationActor,
) {
  const data = markNotificationsReadSchema.parse(payload);

  if (actor.role !== UserRole.admin && actor.id !== data.userId) {
    throw createHttpError(403, "Forbidden");
  }

  const where: Prisma.NotificationWhereInput = {
    userId: data.userId,
    deletedAt: null,
  };

  if (data.notificationIds && data.notificationIds.length > 0) {
    where.id = { in: data.notificationIds };
  }

  const result = await prisma.notification.updateMany({
    where: {
      ...where,
      readAt: null,
    },
    data: {
      readAt: new Date(),
      status: "read",
    },
  });

  return {
    userId: data.userId,
    updatedCount: result.count,
  };
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
