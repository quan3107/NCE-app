/**
 * File: src/modules/rubrics/rubrics.routes.ts
 * Purpose: Register course-scoped rubric endpoints.
 * Why: Keeps routing consistent with the PRD's course/rubric structure.
 */
import { UserRole } from "../../prisma/generated/client/client.js";
import { Router } from "express";

import { authGuard } from "../../middleware/authGuard.js";
import { roleGuard } from "../../middleware/roleGuard.js";
import { getRubrics, postRubric } from "./rubrics.controller.js";

export const rubricRouter = Router({ mergeParams: true });

rubricRouter.use(authGuard);

rubricRouter.get("/", getRubrics);
rubricRouter.post(
  "/",
  roleGuard([UserRole.admin, UserRole.teacher]),
  postRubric,
);
