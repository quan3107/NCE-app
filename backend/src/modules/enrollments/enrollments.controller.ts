/**
 * File: src/modules/enrollments/enrollments.controller.ts
 * Purpose: Handle enrollment HTTP requests for admin workflows.
 * Why: Keeps request/response logic clean while services manage persistence.
 */
import { type Request, type Response } from "express";

import {
  createEnrollment,
  listEnrollments,
} from "./enrollments.service.js";

export async function getEnrollments(
  req: Request,
  res: Response,
): Promise<void> {
  const actor = req.user;

  if (!actor) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const enrollments = await listEnrollments(req.query);
  res.status(200).json(enrollments);
}

export async function postEnrollment(
  req: Request,
  res: Response,
): Promise<void> {
  const actor = req.user;

  if (!actor) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const enrollment = await createEnrollment(req.body);
  res.status(201).json(enrollment);
}
