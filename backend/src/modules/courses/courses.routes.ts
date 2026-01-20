/**
 * File: src/modules/courses/courses.routes.ts
 * Purpose: Wire course HTTP endpoints to their controllers.
 * Why: Centralizes REST route declarations for course resources.
 */
import { UserRole } from "@prisma/client";
import { Router } from "express";

import { authGuard } from "../../middleware/authGuard.js";
import { roleGuard } from "../../middleware/roleGuard.js";
import {
  deleteCourseStudent,
  getCourse,
  getCourses,
  getCourseStudents,
  postCourse,
  postCourseStudent,
} from "./courses.controller.js";

export const courseRouter = Router();

courseRouter.use(authGuard);

courseRouter.get("/", getCourses);
courseRouter.post(
  "/",
  roleGuard([UserRole.admin, UserRole.teacher]),
  postCourse,
);
courseRouter.get(
  "/:courseId/students",
  roleGuard([UserRole.admin, UserRole.teacher]),
  getCourseStudents,
);
courseRouter.post(
  "/:courseId/students",
  roleGuard([UserRole.admin, UserRole.teacher]),
  postCourseStudent,
);
courseRouter.delete(
  "/:courseId/students/:studentId",
  roleGuard([UserRole.admin, UserRole.teacher]),
  deleteCourseStudent,
);
courseRouter.get("/:courseId", getCourse);
