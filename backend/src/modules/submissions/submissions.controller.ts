/**
 * File: src/modules/submissions/submissions.controller.ts
 * Purpose: Provide controllers for submission endpoints while business logic is pending.
 * Why: Retains separation between HTTP handling and domain operations.
 */
import { type Request, type Response } from "express";

import {
  createSubmission,
  getSubmissionById,
  listSubmissions,
} from "./submissions.service.js";

export async function getSubmissions(
  req: Request,
  res: Response,
): Promise<void> {
  await listSubmissions(req.params);
  res
    .status(501)
    .json({ message: "Submission listing not implemented yet." });
}

export async function postSubmission(
  req: Request,
  res: Response,
): Promise<void> {
  await createSubmission(req.params, req.body);
  res
    .status(501)
    .json({ message: "Submission creation not implemented yet." });
}

export async function getSubmission(
  req: Request,
  res: Response,
): Promise<void> {
  await getSubmissionById(req.params);
  res
    .status(501)
    .json({ message: "Submission lookup not implemented yet." });
}
