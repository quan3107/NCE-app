/**
 * File: src/modules/assignments/assignments.controller.ts
 * Purpose: Handle HTTP routing for assignment endpoints while delegating to services.
 * Why: Preserves a clean controller-service boundary for assignment workflows.
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
  const assignments = await listAssignments(req.params);
  res.status(200).json(assignments);
}

export async function getAssignmentById(
  req: Request,
  res: Response,
): Promise<void> {
  const assignment = await getAssignment(req.params);
  res.status(200).json(assignment);
}

export async function postAssignment(
  req: Request,
  res: Response,
): Promise<void> {
  const assignment = await createAssignment(req.params, req.body);
  res.status(201).json(assignment);
}
