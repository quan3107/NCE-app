/**
 * File: src/modules/submissions/submissions-top-level.routes.ts
 * Purpose: Register top-level submission endpoints (not assignment-scoped).
 * Why: Provides endpoints like /submissions/pending-count that don't require assignment context.
 */
import { UserRole } from "../../prisma/generated/client/client.js";
import { Router } from "express";

import { authGuard } from "../../middleware/authGuard.js";
import { roleGuard } from "../../middleware/roleGuard.js";
import { getUngradedSubmissionsCount } from "./submissions.controller.js";

export const submissionsTopLevelRouter = Router();

submissionsTopLevelRouter.use(authGuard);

/**
 * GET /api/v1/submissions/pending-count
 * Returns the count of ungraded submissions for the authenticated teacher/admin.
 */
submissionsTopLevelRouter.get(
  "/pending-count",
  roleGuard([UserRole.teacher, UserRole.admin]),
  getUngradedSubmissionsCount,
);
