/**
 * File: src/modules/grades/grades.routes.ts
 * Purpose: Register grading routes scoped to submissions.
 * Why: Keeps grade REST definitions isolated for easier evolution.
 */
import { Router } from "express";

import {
  getSubmissionGrade,
  putGrade,
} from "./grades.controller.js";

export const gradeRouter = Router({ mergeParams: true });

gradeRouter.get("/", getSubmissionGrade);
gradeRouter.put("/", putGrade);
