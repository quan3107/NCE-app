/**
 * File: src/modules/nce-content/nce-content.routes.ts
 * Purpose: Register read-only NCE catalog and course-assigned lesson routes.
 * Why: Gives students and teachers stable content endpoints without authoring mutations.
 */
import { Router } from "express";

import { authGuard } from "../../middleware/authGuard.js";
import {
  getCourseNceLessons,
  getNceBooks,
  getNceLesson,
  getNceLessons,
  getNceUnits,
} from "./nce-content.controller.js";

export const nceContentRouter = Router();
export const courseNceContentRouter = Router({ mergeParams: true });

nceContentRouter.get("/books", getNceBooks);
nceContentRouter.get("/books/:bookId/units", getNceUnits);
nceContentRouter.get("/units/:unitId/lessons", getNceLessons);
nceContentRouter.get("/lessons/:lessonId", getNceLesson);

courseNceContentRouter.use(authGuard);
courseNceContentRouter.get("/", getCourseNceLessons);
