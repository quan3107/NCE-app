/**
 * File: src/modules/notifications/notifications.controller.ts
 * Purpose: Serve as the HTTP glue for notification operations with persisted data.
 * Why: Preserves a clear boundary between routing and notification services.
 */
import { type Request, type Response } from "express";

import {
  createNotification,
  getNotificationById,
  listNotifications,
  markNotificationsRead,
} from "./notifications.service.js";

export async function getNotifications(
  req: Request,
  res: Response,
): Promise<void> {
  const actor = req.user;

  if (!actor) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const result = await listNotifications(actor, req.query);
  if (result.nextCursor) {
    res.set("x-next-cursor", result.nextCursor);
  }
  res.status(200).json(result.data);
}

export async function postNotification(
  req: Request,
  res: Response,
): Promise<void> {
  const notification = await createNotification(req.body);
  res.status(201).json(notification);
}

export async function getNotification(
  req: Request,
  res: Response,
): Promise<void> {
  const actor = req.user;

  if (!actor) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const notification = await getNotificationById(req.params, actor);
  res.status(200).json(notification);
}

export async function postNotificationsRead(
  req: Request,
  res: Response,
): Promise<void> {
  const actor = req.user;

  if (!actor) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const result = await markNotificationsRead(req.body, actor);
  res.status(200).json(result);
}
