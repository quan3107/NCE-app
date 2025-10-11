/**
 * File: src/modules/courses/courses.controller.ts
 * Purpose: Bridge HTTP requests to course service stubs with consistent responses.
 * Why: Keeps the routing layer declarative while business logic evolves.
 */
import { type Request, type Response } from "express";

import {
  addStudentToCourse,
  createCourse,
  getCourseById,
  listCourses,
  listStudentsForCourse,
  removeStudentFromCourse,
} from "./courses.service.js";

export async function getCourses(req: Request, res: Response): Promise<void> {
  const actor = req.user;

  if (!actor) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const payload = await listCourses(actor);
  res.status(200).json(payload);
}

export async function getCourse(req: Request, res: Response): Promise<void> {
  const actor = req.user;

  if (!actor) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const payload = await getCourseById(req.params, actor);
  res.status(200).json(payload);
}

export async function postCourse(
  req: Request,
  res: Response,
): Promise<void> {
  await createCourse(req.body);
  res.status(501).json({ message: "Course creation not implemented yet." });
}

export async function getCourseStudents(
  req: Request,
  res: Response,
): Promise<void> {
  const actor = req.user;

  if (!actor) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const payload = await listStudentsForCourse(req.params, actor);
  res.status(200).json(payload);
}

export async function postCourseStudent(
  req: Request,
  res: Response,
): Promise<void> {
  const actor = req.user;

  if (!actor) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const student = await addStudentToCourse(req.params, req.body, actor);
  res.status(201).json(student);
}

export async function deleteCourseStudent(
  req: Request,
  res: Response,
): Promise<void> {
  const actor = req.user;

  if (!actor) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  await removeStudentFromCourse(req.params, actor);
  res.status(204).send();
}
