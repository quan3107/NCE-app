/**
 * File: src/modules/submissions/submissions.routes.ts
 * Purpose: Connect submission controllers to Express routes.
 * Why: Makes submission routing explicit and versionable.
 */
import { UserRole } from "../../prisma/generated/client/client.js";
import { Router } from "express";

import { authGuard } from "../../middleware/authGuard.js";
import { roleGuard } from "../../middleware/roleGuard.js";
import {
  getSubmission,
  getSubmissions,
  postSubmission,
} from "./submissions.controller.js";

export const submissionRouter = Router({ mergeParams: true });

submissionRouter.use(authGuard);

submissionRouter.get(
  "/",
  roleGuard([UserRole.admin, UserRole.teacher, UserRole.student]),
  getSubmissions,
);
submissionRouter.post(
  "/",
  roleGuard([UserRole.student]),
  postSubmission,
);
submissionRouter.get(
  "/:submissionId",
  roleGuard([UserRole.admin, UserRole.teacher]),
  getSubmission,
);
