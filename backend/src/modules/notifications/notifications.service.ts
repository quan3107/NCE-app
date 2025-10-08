/**
 * File: src/modules/notifications/notifications.service.ts
 * Purpose: Stub notification workflows ahead of pg-boss integration.
 * Why: Keeps notification logic isolated from transport-specific code.
 */
import {
  createNotificationSchema,
  notificationIdParamsSchema,
} from "./notifications.schema.js";

export async function listNotifications(): Promise<void> {
  // Notification listing will leverage filters in later iterations.
}

export async function createNotification(payload: unknown): Promise<void> {
  createNotificationSchema.parse(payload);
}

export async function getNotificationById(params: unknown): Promise<void> {
  notificationIdParamsSchema.parse(params);
}
