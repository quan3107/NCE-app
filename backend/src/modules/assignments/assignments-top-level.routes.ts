/**
 * File: src/modules/assignments/assignments-top-level.routes.ts
 * Purpose: Register top-level assignment endpoints (not course-scoped).
 * Why: Provides endpoints like /assignments/pending-count that don't require course context.
 */
import { UserRole } from "../../prisma/index.js";
import { Router } from "express";

import { authGuard } from "../../middleware/authGuard.js";
import { roleGuard } from "../../middleware/roleGuard.js";
import { getAccessibleAssignments, getPendingAssignmentsCount } from "./assignments.controller.js";
import { getOverview, getAssignmentSummaries, getAssignmentOverview } from './assignments.staff-controller.js';

export const assignmentsTopLevelRouter = Router();

assignmentsTopLevelRouter.use(authGuard);
const staff = roleGuard([UserRole.teacher, UserRole.admin]);
assignmentsTopLevelRouter.get('/overview', staff, getOverview);
assignmentsTopLevelRouter.get('/summaries', staff, getAssignmentSummaries);
assignmentsTopLevelRouter.get('/:assignmentId/overview', staff, getAssignmentOverview);

assignmentsTopLevelRouter.get('/accessible', getAccessibleAssignments);

/**
 * GET /api/v1/assignments/pending-count
 * Returns the count of pending assignments for the authenticated student.
 */
assignmentsTopLevelRouter.get(
  "/pending-count",
  roleGuard([UserRole.student]),
  getPendingAssignmentsCount,
);
