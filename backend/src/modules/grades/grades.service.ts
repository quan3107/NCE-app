/**
 * File: src/modules/grades/grades.service.ts
 * Purpose: Stub grading logic for future implementation.
 * Why: Keeps scoring routines decoupled from controllers.
 */
import {
  gradePayloadSchema,
  submissionScopedParamsSchema,
} from "./grades.schema.js";

export async function upsertGrade(
  params: unknown,
  payload: unknown,
): Promise<void> {
  submissionScopedParamsSchema.parse(params);
  gradePayloadSchema.parse(payload);
}

export async function getGrade(params: unknown): Promise<void> {
  submissionScopedParamsSchema.parse(params);
}
