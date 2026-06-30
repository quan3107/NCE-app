/**
 * File: src/modules/notifications/notifications.routes.ts
 * Purpose: Declare notification REST endpoints.
 * Why: Keeps API routing cohesive and maintainable.
 */
import { UserRole } from "../../prisma/index.js";
import { Router } from "express";

import { authGuard } from "../../middleware/authGuard.js";
import { roleGuard } from "../../middleware/roleGuard.js";
import {
  getNotification,
  getNotifications,
  postNotificationResend,
  postNotificationsRead,
  postNotification,
} from "./notifications.controller.js";

export const notificationRouter = Router();

notificationRouter.use(authGuard);

notificationRouter.get("/", getNotifications);
notificationRouter.post(
  "/",
  roleGuard([UserRole.admin]),
  postNotification,
);
notificationRouter.post("/read", postNotificationsRead);
notificationRouter.post(
  "/:notificationId/resend",
  roleGuard([UserRole.admin]),
  postNotificationResend,
);
notificationRouter.get("/:notificationId", getNotification);
