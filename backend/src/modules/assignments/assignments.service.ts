/**
 * File: src/modules/assignments/assignments.service.ts
 * Purpose: Stub assignment logic for future data access implementations.
 * Why: Keeps assignment-specific operations encapsulated away from controllers.
 */
import {
  assignmentIdParamsSchema,
  courseScopedParamsSchema,
  createAssignmentSchema,
} from "./assignments.schema.js";

export async function listAssignments(params: unknown): Promise<void> {
  courseScopedParamsSchema.parse(params);
}

export async function getAssignment(params: unknown): Promise<void> {
  assignmentIdParamsSchema.parse(params);
}

export async function createAssignment(
  params: unknown,
  payload: unknown,
): Promise<void> {
  courseScopedParamsSchema.parse(params);
  createAssignmentSchema.parse(payload);
}
