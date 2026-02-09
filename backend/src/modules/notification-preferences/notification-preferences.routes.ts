/**
 * File: src/modules/notification-preferences/notification-preferences.routes.ts
 * Purpose: Register authenticated routes for per-user notification preferences.
 * Why: Exposes backend-managed preference controls used by teacher notification filters.
 */

import { Router } from "express";

import { authGuard } from "../../middleware/authGuard.js";
import { roleGuard } from "../../middleware/roleGuard.js";
import { UserRole } from "../../prisma/index.js";
import {
  deleteMyNotificationPreferences,
  getMyNotificationPreferences,
  putMyNotificationPreferences,
} from "./notification-preferences.controller.js";

export const meNotificationPreferencesRouter = Router();

meNotificationPreferencesRouter.use(authGuard);
meNotificationPreferencesRouter.use(roleGuard([UserRole.teacher]));

meNotificationPreferencesRouter.get("/", getMyNotificationPreferences);
meNotificationPreferencesRouter.put("/", putMyNotificationPreferences);
meNotificationPreferencesRouter.delete("/", deleteMyNotificationPreferences);
