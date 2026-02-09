/**
 * File: src/modules/notification-config/notification-config.controller.ts
 * Purpose: Serve HTTP responses for role-based notification type configuration.
 * Why: Keeps transport concerns separate from fallback and persistence logic.
 */

import type { NextFunction, Request, Response } from "express";

import { logger } from "../../config/logger.js";
import { notificationTypesResponseSchema } from "./notification-config.schema.js";
import { getNotificationTypesForRole } from "./notification-config.service.js";

export async function getNotificationTypes(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = req.user;

    if (!user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const payload = await getNotificationTypesForRole(user.role);

    try {
      const validated = notificationTypesResponseSchema.parse(payload);
      res.status(200).json(validated);
    } catch (error) {
      logger.error(
        {
          event: "notification_types_response_validation_failed",
          role: user.role,
          err: error,
        },
        "Notification type config response failed schema validation",
      );
      throw error;
    }
  } catch (error) {
    next(error);
  }
}
