/**
 * File: src/modules/dashboard-config/dashboard-config.routes.ts
 * Purpose: Register dashboard widget defaults and personalization endpoints.
 * Why: Keeps endpoint wiring centralized and consistent with other config modules.
 */

import { Router } from "express";

import { authGuard } from "../../middleware/authGuard.js";
import {
  deleteMyDashboardConfig,
  getDashboardWidgetDefaults,
  getMyDashboardConfig,
  putMyDashboardConfig,
} from "./dashboard-config.controller.js";

export const dashboardWidgetsRouter = Router();
export const meDashboardConfigRouter = Router();

dashboardWidgetsRouter.use(authGuard);
meDashboardConfigRouter.use(authGuard);

dashboardWidgetsRouter.get("/", getDashboardWidgetDefaults);

meDashboardConfigRouter.get("/", getMyDashboardConfig);
meDashboardConfigRouter.put("/", putMyDashboardConfig);
meDashboardConfigRouter.delete("/", deleteMyDashboardConfig);
