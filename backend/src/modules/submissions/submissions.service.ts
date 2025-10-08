/**
 * File: src/modules/submissions/submissions.service.ts
 * Purpose: House submission logic stubs for later Prisma integration.
 * Why: Keeps submission domain code organized and testable.
 */
import {
  assignmentScopedParamsSchema,
  createSubmissionSchema,
  submissionIdParamsSchema,
} from "./submissions.schema.js";

export async function listSubmissions(params: unknown): Promise<void> {
  assignmentScopedParamsSchema.parse(params);
}

export async function createSubmission(
  params: unknown,
  payload: unknown,
): Promise<void> {
  assignmentScopedParamsSchema.parse(params);
  createSubmissionSchema.parse(payload);
}

export async function getSubmissionById(
  params: unknown,
): Promise<void> {
  submissionIdParamsSchema.parse(params);
}
