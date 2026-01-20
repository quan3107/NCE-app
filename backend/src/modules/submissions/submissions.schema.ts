/**
 * File: src/modules/submissions/submissions.schema.ts
 * Purpose: Outline schemas for submission creation and retrieval.
 * Why: Sets up validation scaffolding for submission workflows.
 */
import { z } from "zod";

export const assignmentScopedParamsSchema = z.object({
  assignmentId: z.string().uuid(),
});

export const submissionIdParamsSchema = z.object({
  submissionId: z.string().uuid(),
});

export const createSubmissionSchema = z
  .object({
    studentId: z.string().uuid(),
    payload: z.record(z.string(), z.unknown()),
    submittedAt: z.string().optional(),
    status: z.enum(["draft", "submitted", "late"]).optional(),
  })
  .strict();
