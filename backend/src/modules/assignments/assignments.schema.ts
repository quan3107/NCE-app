/**
 * File: src/modules/assignments/assignments.schema.ts
 * Purpose: Capture validation schemas for assignment CRUD requests.
 * Why: Provides reusable parsing logic for assignment workflows once implemented.
 */
import { z } from "zod";

export const assignmentIdParamsSchema = z.object({
  assignmentId: z.string().uuid(),
});

export const courseScopedParamsSchema = z.object({
  courseId: z.string().uuid(),
});

export const createAssignmentSchema = z
  .object({
    title: z.string().min(1),
    descriptionMd: z.string().optional(),
    type: z.enum(["file", "link", "text", "quiz"]),
    dueAt: z.string().optional(),
    latePolicy: z.record(z.string(), z.unknown()).optional(),
    publishedAt: z.string().optional(),
  })
  .strict();
