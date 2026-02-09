/**
 * File: src/modules/notification-preferences/notification-preferences.controller.ts
 * Purpose: Handle authenticated notification preference requests for the current user.
 * Why: Keeps HTTP concerns thin while delegating preference logic to the service layer.
 */

import type { Request, Response } from "express";

import {
  myNotificationPreferencesResponseSchema,
  updateMyNotificationPreferencesRequestSchema,
} from "./notification-preferences.schema.js";
import {
  getMyNotificationPreferencesForUser,
  resetMyNotificationPreferencesForUser,
  saveMyNotificationPreferencesForUser,
} from "./notification-preferences.service.js";

export async function getMyNotificationPreferences(
  req: Request,
  res: Response,
): Promise<void> {
  const user = req.user;

  if (!user) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const payload = await getMyNotificationPreferencesForUser(user.id, user.role);
  res.status(200).json(myNotificationPreferencesResponseSchema.parse(payload));
}

export async function putMyNotificationPreferences(
  req: Request,
  res: Response,
): Promise<void> {
  const user = req.user;

  if (!user) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const body = updateMyNotificationPreferencesRequestSchema.parse(req.body);
  const payload = await saveMyNotificationPreferencesForUser(
    user.id,
    user.role,
    body,
  );

  res.status(200).json(myNotificationPreferencesResponseSchema.parse(payload));
}

export async function deleteMyNotificationPreferences(
  req: Request,
  res: Response,
): Promise<void> {
  const user = req.user;

  if (!user) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  await resetMyNotificationPreferencesForUser(user.id);
  res.status(204).send();
}
