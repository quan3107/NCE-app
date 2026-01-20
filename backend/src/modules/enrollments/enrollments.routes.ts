/**
 * File: src/modules/enrollments/enrollments.routes.ts
 * Purpose: Define admin-facing enrollment routes.
 * Why: Exposes enrollment management endpoints aligned with the PRD.
 */
import { Router } from "express";

import { authGuard } from "../../middleware/authGuard.js";
import {
  getEnrollments,
  postEnrollment,
} from "./enrollments.controller.js";

export const enrollmentRouter = Router();

enrollmentRouter.use(authGuard);

enrollmentRouter.get("/", getEnrollments);
enrollmentRouter.post("/", postEnrollment);
