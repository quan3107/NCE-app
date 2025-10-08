/**
 * File: src/modules/assignments/assignments.controller.ts
 * Purpose: Handle HTTP routing for assignment endpoints while delegating to service stubs.
 * Why: Preserves a clean controller-service boundary for future business logic.
 */
import { type Request, type Response } from "express";

import {
  createAssignment,
  getAssignment,
  listAssignments,
} from "./assignments.service.js";

export async function getAssignments(
  req: Request,
  res: Response,
): Promise<void> {
  await listAssignments(req.params);
  res
    .status(501)
    .json({ message: "Assignment listing not implemented yet." });
}

export async function getAssignmentById(
  req: Request,
  res: Response,
): Promise<void> {
  await getAssignment(req.params);
  res
    .status(501)
    .json({ message: "Assignment lookup not implemented yet." });
}

export async function postAssignment(
  req: Request,
  res: Response,
): Promise<void> {
  await createAssignment(req.params, req.body);
  res
    .status(501)
    .json({ message: "Assignment creation not implemented yet." });
}
