/**
 * File: src/modules/notifications/notifications.schema.ts
 * Purpose: Define schemas for notification publishing and querying.
 * Why: Establishes input validation for notification workflows.
 */
import { z } from "zod";

export const DEFAULT_NOTIFICATION_LIMIT = 50;
const MAX_NOTIFICATION_LIMIT = 100;

export const notificationIdParamsSchema = z.object({
  notificationId: z.string().uuid(),
});

export const notificationQuerySchema = z
  .object({
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(MAX_NOTIFICATION_LIMIT)
      .optional(),
    cursor: z.string().uuid().optional(),
  })
  .strict();

export const createNotificationSchema = z
  .object({
    userId: z.string().uuid(),
    channel: z.enum(["inapp", "email", "push", "sms"]),
    template: z.string().min(1),
    payload: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export const markNotificationsReadSchema = z
  .object({
    userId: z.string().uuid(),
    notificationIds: z.array(z.string().uuid()).min(1).optional(),
  })
  .strict();
