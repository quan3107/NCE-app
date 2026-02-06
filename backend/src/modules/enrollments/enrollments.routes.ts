/**
 * File: src/modules/enrollments/enrollments.routes.ts
 * Purpose: Define admin-facing enrollment routes.
 * Why: Exposes enrollment management endpoints aligned with the PRD.
 */
import { UserRole } from "../../prisma/index.js";
import { Router } from "express";

import { authGuard } from "../../middleware/authGuard.js";
import { roleGuard } from "../../middleware/roleGuard.js";
import {
  deleteEnrollmentById,
  getEnrollments,
  postEnrollment,
} from "./enrollments.controller.js";

export const enrollmentRouter = Router();

enrollmentRouter.use(authGuard);
enrollmentRouter.use(roleGuard([UserRole.admin]));

enrollmentRouter.get("/", getEnrollments);
enrollmentRouter.post("/", postEnrollment);
enrollmentRouter.delete("/:enrollmentId", deleteEnrollmentById);
