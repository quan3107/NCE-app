/**
 * File: src/modules/notifications/notifications.routes.ts
 * Purpose: Declare notification REST endpoints.
 * Why: Keeps API routing cohesive and maintainable.
 */
import { Router } from "express";

import {
  getNotification,
  getNotifications,
  postNotification,
} from "./notifications.controller.js";

export const notificationRouter = Router();

notificationRouter.get("/", getNotifications);
notificationRouter.post("/", postNotification);
notificationRouter.get("/:notificationId", getNotification);
