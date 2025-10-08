/**
 * File: src/modules/grades/grades.controller.ts
 * Purpose: Provide HTTP handlers for grading operations while logic is pending.
 * Why: Maintains the controller-service split for the grading domain.
 */
import { type Request, type Response } from "express";

import { getGrade, upsertGrade } from "./grades.service.js";

export async function putGrade(req: Request, res: Response): Promise<void> {
  await upsertGrade(req.params, req.body);
  res.status(501).json({ message: "Grade upsert not implemented yet." });
}

export async function getSubmissionGrade(
  req: Request,
  res: Response,
): Promise<void> {
  await getGrade(req.params);
  res.status(501).json({ message: "Grade retrieval not implemented yet." });
}
