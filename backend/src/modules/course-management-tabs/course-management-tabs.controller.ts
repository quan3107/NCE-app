/**
 * File: src/modules/course-management-tabs/course-management-tabs.controller.ts
 * Purpose: Serve HTTP responses for role-scoped course management tabs config.
 * Why: Keeps transport concerns separate from config fallback and permission filtering.
 */

import type { NextFunction, Request, Response } from "express";

import { logger } from "../../config/logger.js";
import { courseManagementTabsResponseSchema } from "./course-management-tabs.schema.js";
import { getCourseManagementTabsForRole } from "./course-management-tabs.service.js";

export async function getCourseManagementTabs(
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

    const payload = await getCourseManagementTabsForRole(user.role);

    try {
      const validated = courseManagementTabsResponseSchema.parse(payload);
      res.status(200).json(validated);
    } catch (error) {
      logger.error(
        {
          event: "course_management_tabs_response_validation_failed",
          role: user.role,
          err: error,
        },
        "Course management tabs response failed schema validation",
      );
      throw error;
    }
  } catch (error) {
    next(error);
  }
}
