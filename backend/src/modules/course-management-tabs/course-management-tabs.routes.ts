/**
 * File: src/modules/course-management-tabs/course-management-tabs.routes.ts
 * Purpose: Register role-scoped course management tabs config endpoints.
 * Why: Keeps endpoint wiring consistent with other backend-driven config modules.
 */

import { Router } from "express";

import { authGuard } from "../../middleware/authGuard.js";
import { getCourseManagementTabs } from "./course-management-tabs.controller.js";

export const courseManagementTabsRouter = Router();

courseManagementTabsRouter.use(authGuard);
courseManagementTabsRouter.get("/", getCourseManagementTabs);
