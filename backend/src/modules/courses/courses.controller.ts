/**
 * File: src/modules/courses/courses.controller.ts
 * Purpose: Bridge HTTP requests to course service stubs with consistent responses.
 * Why: Keeps the routing layer declarative while business logic evolves.
 */
import { type Request, type Response } from "express";

import {
  createCourse,
  getCourseById,
  listCourses,
} from "./courses.service.js";

export async function getCourses(_req: Request, res: Response): Promise<void> {
  await listCourses();
  res.status(501).json({ message: "Course listing not implemented yet." });
}

export async function getCourse(req: Request, res: Response): Promise<void> {
  await getCourseById(req.params);
  res.status(501).json({ message: "Course lookup not implemented yet." });
}

export async function postCourse(
  req: Request,
  res: Response,
): Promise<void> {
  await createCourse(req.body);
  res.status(501).json({ message: "Course creation not implemented yet." });
}
