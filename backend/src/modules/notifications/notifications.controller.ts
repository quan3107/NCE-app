/**
 * File: src/modules/notifications/notifications.controller.ts
 * Purpose: Serve as the HTTP glue for notification operations.
 * Why: Preserves a clear boundary between routing and notification services.
 */
import { type Request, type Response } from "express";

import {
  createNotification,
  getNotificationById,
  listNotifications,
} from "./notifications.service.js";

export async function getNotifications(
  _req: Request,
  res: Response,
): Promise<void> {
  await listNotifications();
  res
    .status(501)
    .json({ message: "Notification listing not implemented yet." });
}

export async function postNotification(
  req: Request,
  res: Response,
): Promise<void> {
  await createNotification(req.body);
  res
    .status(501)
    .json({ message: "Notification creation not implemented yet." });
}

export async function getNotification(
  req: Request,
  res: Response,
): Promise<void> {
  await getNotificationById(req.params);
  res
    .status(501)
    .json({ message: "Notification lookup not implemented yet." });
}
