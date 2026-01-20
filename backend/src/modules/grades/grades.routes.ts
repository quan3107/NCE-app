/**
 * File: src/modules/grades/grades.routes.ts
 * Purpose: Register grading routes scoped to submissions.
 * Why: Keeps grade REST definitions isolated for easier evolution.
 */
import { UserRole } from "@prisma/client";
import { Router } from "express";

import { authGuard } from "../../middleware/authGuard.js";
import { roleGuard } from "../../middleware/roleGuard.js";
import {
  getSubmissionGrade,
  putGrade,
} from "./grades.controller.js";

export const gradeRouter = Router({ mergeParams: true });

gradeRouter.use(authGuard);

gradeRouter.get(
  "/",
  roleGuard([UserRole.admin, UserRole.teacher]),
  getSubmissionGrade,
);
gradeRouter.put(
  "/",
  roleGuard([UserRole.admin, UserRole.teacher]),
  putGrade,
);
