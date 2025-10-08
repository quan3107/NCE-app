/**
 * File: src/modules/notifications/notifications.schema.ts
 * Purpose: Define schemas for notification publishing and querying.
 * Why: Establishes input validation for notification workflows.
 */
import { z } from "zod";

export const notificationIdParamsSchema = z.object({
  notificationId: z.string().uuid(),
});

export const createNotificationSchema = z
  .object({
    userId: z.string().uuid(),
    channel: z.enum(["inapp", "email", "push", "sms"]),
    template: z.string().min(1),
    payload: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();
