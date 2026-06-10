/**
 * File: src/modules/submissions/submissions-top-level.routes.ts
 * Purpose: Register top-level submission endpoints (not assignment-scoped).
 * Why: Provides endpoints like /submissions/pending-count that don't require assignment context.
 */
import { UserRole } from "../../prisma/index.js";
import { Router } from "express";

import { authGuard } from "../../middleware/authGuard.js";
import { roleGuard } from "../../middleware/roleGuard.js";
import {
  getWritingFeedbackDraftHistory,
  getObjectiveExplanationStatus,
  getWritingFeedbackStatus,
  postWritingFeedbackApproval,
  postWritingFeedbackFinalization,
  postObjectiveExplanationRequest,
  postWritingFeedbackRequest,
  postWritingFeedbackRegeneration,
  postWritingFeedbackRejection,
} from "../ai-feedback/ai-feedback.controller.js";
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

submissionsTopLevelRouter.post(
  "/:submissionId/questions/:questionId/ai-explanation",
  roleGuard([UserRole.admin, UserRole.teacher, UserRole.student]),
  postObjectiveExplanationRequest,
);

submissionsTopLevelRouter.get(
  "/:submissionId/questions/:questionId/ai-explanation",
  roleGuard([UserRole.admin, UserRole.teacher, UserRole.student]),
  getObjectiveExplanationStatus,
);

submissionsTopLevelRouter.post(
  "/:submissionId/ai-feedback/writing",
  roleGuard([UserRole.admin, UserRole.teacher]),
  postWritingFeedbackRequest,
);

submissionsTopLevelRouter.get(
  "/:submissionId/ai-feedback/writing",
  roleGuard([UserRole.admin, UserRole.teacher]),
  getWritingFeedbackStatus,
);

submissionsTopLevelRouter.get(
  "/:submissionId/ai-feedback/writing/drafts",
  roleGuard([UserRole.admin, UserRole.teacher]),
  getWritingFeedbackDraftHistory,
);

submissionsTopLevelRouter.post(
  "/:submissionId/ai-feedback/writing/regenerate",
  roleGuard([UserRole.admin, UserRole.teacher]),
  postWritingFeedbackRegeneration,
);

submissionsTopLevelRouter.post(
  "/:submissionId/ai-feedback/writing/drafts/:draftId/approve",
  roleGuard([UserRole.admin, UserRole.teacher]),
  postWritingFeedbackApproval,
);

submissionsTopLevelRouter.post(
  "/:submissionId/ai-feedback/writing/drafts/:draftId/reject",
  roleGuard([UserRole.admin, UserRole.teacher]),
  postWritingFeedbackRejection,
);

submissionsTopLevelRouter.post(
  "/:submissionId/ai-feedback/writing/drafts/:draftId/finalize",
  roleGuard([UserRole.admin, UserRole.teacher]),
  postWritingFeedbackFinalization,
);
