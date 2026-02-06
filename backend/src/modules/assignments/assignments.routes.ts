/**
 * File: src/modules/assignments/assignments.routes.ts
 * Purpose: Register course-scoped assignment endpoints.
 * Why: Aligns with PRD expectations for course/assignment hierarchy.
 */
import { UserRole } from "../../prisma/index.js";
import { Router } from "express";

import { authGuard } from "../../middleware/authGuard.js";
import { roleGuard } from "../../middleware/roleGuard.js";
import {
  deleteAssignmentById,
  getAssignmentById,
  getAssignments,
  patchAssignment,
  postAssignment,
} from "./assignments.controller.js";

export const assignmentRouter = Router({ mergeParams: true });

assignmentRouter.use(authGuard);

assignmentRouter.get("/", getAssignments);
assignmentRouter.post(
  "/",
  roleGuard([UserRole.admin, UserRole.teacher]),
  postAssignment,
);
assignmentRouter.get("/:assignmentId", getAssignmentById);
assignmentRouter.patch(
  "/:assignmentId",
  roleGuard([UserRole.admin, UserRole.teacher]),
  patchAssignment,
);
assignmentRouter.delete(
  "/:assignmentId",
  roleGuard([UserRole.admin, UserRole.teacher]),
  deleteAssignmentById,
);
