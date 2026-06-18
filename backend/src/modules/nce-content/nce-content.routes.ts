/**
 * File: src/modules/nce-content/nce-content.routes.ts
 * Purpose: Register read-only NCE catalog and course-assigned lesson routes.
 * Why: Gives students and teachers stable content endpoints without authoring mutations.
 */
import { Router } from "express";

import { authGuard } from "../../middleware/authGuard.js";
import {
  patchNceLessonHandler,
  postNceLesson,
  publishNceLessonHandler,
  putCourseNceLessons,
  unpublishNceLessonHandler,
} from "./nce-content-authoring.controller.js";
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
nceContentRouter.post("/lessons", authGuard, postNceLesson);
nceContentRouter.patch("/lessons/:lessonId", authGuard, patchNceLessonHandler);
nceContentRouter.post("/lessons/:lessonId/publish", authGuard, publishNceLessonHandler);
nceContentRouter.post("/lessons/:lessonId/unpublish", authGuard, unpublishNceLessonHandler);
nceContentRouter.get("/lessons/:lessonId", getNceLesson);

courseNceContentRouter.use(authGuard);
courseNceContentRouter.get("/", getCourseNceLessons);
courseNceContentRouter.put("/", putCourseNceLessons);
