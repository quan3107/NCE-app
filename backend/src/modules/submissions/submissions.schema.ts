/**
 * File: src/modules/submissions/submissions.schema.ts
 * Purpose: Outline schemas for submission creation and retrieval.
 * Why: Sets up validation scaffolding for submission workflows.
 */
import { z } from "zod";

export const DEFAULT_SUBMISSION_LIMIT = 50;
const MAX_SUBMISSION_LIMIT = 100;

export const assignmentScopedParamsSchema = z.object({
  assignmentId: z.string().uuid(),
});

export const submissionIdParamsSchema = z.object({
  submissionId: z.string().uuid(),
});

export const submissionQuerySchema = z
  .object({
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(MAX_SUBMISSION_LIMIT)
      .optional(),
    offset: z.coerce.number().int().min(0).optional(),
  })
  .strict();

export const createSubmissionSchema = z
  .object({
    studentId: z.string().uuid(),
    payload: z.record(z.string(), z.unknown()),
    submittedAt: z.string().optional(),
    status: z.enum(["draft", "submitted", "late"]).optional(),
  })
  .strict();

export type CreateSubmissionPayload = z.infer<typeof createSubmissionSchema>;
