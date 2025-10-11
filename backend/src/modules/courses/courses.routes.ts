/**
 * File: src/modules/courses/courses.routes.ts
 * Purpose: Wire course HTTP endpoints to their controllers.
 * Why: Centralizes REST route declarations for course resources.
 */
import { Router } from "express";

import { authGuard } from "../../middleware/authGuard.js";
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
courseRouter.post("/", postCourse);
courseRouter.get("/:courseId/students", getCourseStudents);
courseRouter.post("/:courseId/students", postCourseStudent);
courseRouter.delete("/:courseId/students/:studentId", deleteCourseStudent);
courseRouter.get("/:courseId", getCourse);

