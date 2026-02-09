/**
 * File: src/modules/notification-config/notification-config.routes.ts
 * Purpose: Register role-scoped notification type config endpoints.
 * Why: Keeps endpoint wiring consistent with other backend-driven config modules.
 */

import { Router } from "express";

import { authGuard } from "../../middleware/authGuard.js";
import { getNotificationTypes } from "./notification-config.controller.js";

export const notificationTypesConfigRouter = Router();

notificationTypesConfigRouter.use(authGuard);
notificationTypesConfigRouter.get("/", getNotificationTypes);
