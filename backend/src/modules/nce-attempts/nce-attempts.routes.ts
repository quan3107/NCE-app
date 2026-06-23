/**
 * File: src/modules/nce-attempts/nce-attempts.routes.ts
 * Purpose: Register NCE student learning and attempt routes.
 * Why: Exposes progress, draft, submit, completion, and summary workflows.
 */
import { Router } from "express";

import { authGuard } from "../../middleware/authGuard.js";
import {
  getNceAttemptSummaries,
  getStudentNcePath,
  postCompleteNceLesson,
  postNceAttempt,
  postSubmitNceAttempt,
} from "./nce-attempts.controller.js";

export const courseNceAttemptsRouter = Router({ mergeParams: true });
export const nceAttemptsRouter = Router();

courseNceAttemptsRouter.use(authGuard);
courseNceAttemptsRouter.get("/nce-path", getStudentNcePath);
courseNceAttemptsRouter.get("/nce-attempts", getNceAttemptSummaries);
courseNceAttemptsRouter.post("/nce-exercises/:exerciseId/attempts", postNceAttempt);
courseNceAttemptsRouter.post("/nce-lessons/:lessonId/complete", postCompleteNceLesson);

nceAttemptsRouter.use(authGuard);
nceAttemptsRouter.post("/:attemptId/submit", postSubmitNceAttempt);
