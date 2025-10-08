/**
 * File: src/modules/assignments/assignments.routes.ts
 * Purpose: Register course-scoped assignment endpoints.
 * Why: Aligns with PRD expectations for course/assignment hierarchy.
 */
import { Router } from "express";

import {
  getAssignmentById,
  getAssignments,
  postAssignment,
} from "./assignments.controller.js";

export const assignmentRouter = Router({ mergeParams: true });

assignmentRouter.get("/", getAssignments);
assignmentRouter.post("/", postAssignment);
assignmentRouter.get("/:assignmentId", getAssignmentById);
