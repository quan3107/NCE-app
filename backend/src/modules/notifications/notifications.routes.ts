/**
 * File: src/modules/notifications/notifications.routes.ts
 * Purpose: Declare notification REST endpoints.
 * Why: Keeps API routing cohesive and maintainable.
 */
import { UserRole } from "@prisma/client";
import { Router } from "express";

import { authGuard } from "../../middleware/authGuard.js";
import { roleGuard } from "../../middleware/roleGuard.js";
import {
  getNotification,
  getNotifications,
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
notificationRouter.get("/:notificationId", getNotification);
