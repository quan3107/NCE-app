/**
 * File: src/modules/courses/courses.controller.ts
 * Purpose: Bridge HTTP requests to course services with persisted responses.
 * Why: Keeps the routing layer declarative while business logic evolves.
 */
import { type Request, type Response } from "express";

import {
  createCourse,
  getCourseById,
  listCourses,
} from "./courses.service.js";

export async function getCourses(_req: Request, res: Response): Promise<void> {
  const courses = await listCourses();
  res.status(200).json(courses);
}

export async function getCourse(req: Request, res: Response): Promise<void> {
  const course = await getCourseById(req.params);
  res.status(200).json(course);
}

export async function postCourse(
  req: Request,
  res: Response,
): Promise<void> {
  const course = await createCourse(req.body);
  res.status(201).json(course);
}
