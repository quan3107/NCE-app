/**
 * File: src/modules/courses/courses.routes.ts
 * Purpose: Wire course HTTP endpoints to their controllers.
 * Why: Centralizes REST route declarations for course resources.
 */
import { UserRole } from "../../prisma/index.js";
import { Router } from "express";

import { authGuard } from "../../middleware/authGuard.js";
import { roleGuard } from "../../middleware/roleGuard.js";
import {
  deleteCourseStudent,
  getCourse,
  getCourses,
  getCourseStudents,
  patchCourse,
  postCourse,
  postCourseArchive,
  postCourseRestore,
  postCourseStudent,
} from "./courses.controller.js";

export const courseRouter = Router();

courseRouter.get("/", getCourses);
courseRouter.post(
  "/",
  authGuard,
  roleGuard([UserRole.admin, UserRole.teacher]),
  postCourse,
);
courseRouter.get(
  "/:courseId/students",
  authGuard,
  roleGuard([UserRole.admin, UserRole.teacher]),
  getCourseStudents,
);
courseRouter.post(
  "/:courseId/students",
  authGuard,
  roleGuard([UserRole.admin, UserRole.teacher]),
  postCourseStudent,
);
courseRouter.delete(
  "/:courseId/students/:studentId",
  authGuard,
  roleGuard([UserRole.admin, UserRole.teacher]),
  deleteCourseStudent,
);
courseRouter.post(
  "/:courseId/archive",
  authGuard,
  roleGuard([UserRole.admin, UserRole.teacher]),
  postCourseArchive,
);
courseRouter.post(
  "/:courseId/restore",
  authGuard,
  roleGuard([UserRole.admin, UserRole.teacher]),
  postCourseRestore,
);
courseRouter.get("/:courseId", authGuard, getCourse);
courseRouter.patch(
  "/:courseId",
  authGuard,
  roleGuard([UserRole.admin, UserRole.teacher]),
  patchCourse,
);
