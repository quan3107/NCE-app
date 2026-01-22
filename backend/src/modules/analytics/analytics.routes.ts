/**
 * File: src/modules/analytics/analytics.routes.ts
 * Purpose: Register analytics endpoints for teacher/admin dashboards.
 * Why: Centralizes analytics routing and access control.
 */
import { UserRole } from "@prisma/client";
import { Router } from "express";

import { authGuard } from "../../middleware/authGuard.js";
import { roleGuard } from "../../middleware/roleGuard.js";
import { getTeacherAnalyticsHandler } from "./analytics.controller.js";

export const analyticsRouter = Router();

analyticsRouter.use(authGuard);
analyticsRouter.use(roleGuard([UserRole.admin, UserRole.teacher]));

analyticsRouter.get("/teacher", getTeacherAnalyticsHandler);
