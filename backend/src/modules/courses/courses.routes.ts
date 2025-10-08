/**
 * File: src/modules/courses/courses.routes.ts
 * Purpose: Wire course HTTP endpoints to their controllers.
 * Why: Centralizes REST route declarations for course resources.
 */
import { Router } from "express";

import { getCourse, getCourses, postCourse } from "./courses.controller.js";

export const courseRouter = Router();

courseRouter.get("/", getCourses);
courseRouter.post("/", postCourse);
courseRouter.get("/:courseId", getCourse);
