/**
 * File: src/modules/submissions/submissions.routes.ts
 * Purpose: Connect submission controllers to Express routes.
 * Why: Makes submission routing explicit and versionable.
 */
import { Router } from "express";

import {
  getSubmission,
  getSubmissions,
  postSubmission,
} from "./submissions.controller.js";

export const submissionRouter = Router({ mergeParams: true });

submissionRouter.get("/", getSubmissions);
submissionRouter.post("/", postSubmission);
submissionRouter.get("/:submissionId", getSubmission);
