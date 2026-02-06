/**
 * File: src/modules/rubric-templates/rubric-templates.routes.ts
 * Purpose: Register rubric template endpoints for config and course-scoped reads.
 * Why: Splits endpoint wiring from business logic and keeps API composition predictable.
 */
import { Router } from "express";

import { authGuard } from "../../middleware/authGuard.js";
import {
  getCourseDefaultTemplate,
  getDefaultRubrics,
  getRubricTemplates,
} from "./rubric-templates.controller.js";

export const defaultRubricTemplateRouter = Router();
export const courseDefaultRubricTemplateRouter = Router({ mergeParams: true });
export const rubricTemplatesRouter = Router();

defaultRubricTemplateRouter.use(authGuard);
courseDefaultRubricTemplateRouter.use(authGuard);
rubricTemplatesRouter.use(authGuard);

defaultRubricTemplateRouter.get("/", getDefaultRubrics);
courseDefaultRubricTemplateRouter.get("/", getCourseDefaultTemplate);
rubricTemplatesRouter.get("/", getRubricTemplates);
