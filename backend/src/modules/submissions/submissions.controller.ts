/**
 * File: src/modules/submissions/submissions.controller.ts
 * Purpose: Provide controllers for submission endpoints backed by Prisma services.
 * Why: Retains separation between HTTP handling and domain operations.
 */
import { type Request, type Response } from "express";

import {
  createSubmission,
  getSubmissionById,
  listSubmissions,
  getUngradedSubmissionsCount as getUngradedSubmissionsCountService,
} from "./submissions.service.js";
import { createSubmissionSchema } from "./submissions.schema.js";

export async function getSubmissions(
  req: Request,
  res: Response,
): Promise<void> {
  const submissions = await listSubmissions(req.params, req.query, req.user);
  res.status(200).json(submissions);
}

export async function postSubmission(
  req: Request,
  res: Response,
): Promise<void> {
  const payload = createSubmissionSchema.parse(req.body);
  const submission = await createSubmission(req.params, payload, req.user);
  res.status(201).json(submission);
}

export async function getSubmission(
  req: Request,
  res: Response,
): Promise<void> {
  const submission = await getSubmissionById(req.params);
  res.status(200).json(submission);
}

/**
 * Get count of ungraded submissions for the authenticated teacher/admin.
 */
export async function getUngradedSubmissionsCount(
  req: Request,
  res: Response,
): Promise<void> {
  const user = req.user;

  if (!user) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const count = await getUngradedSubmissionsCountService(user.id);
  res.status(200).json({ count });
}
