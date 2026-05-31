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

const latePolicySchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.enum(["closed", "none", "no_late"]),
    })
    .strict(),
  z
    .object({
      type: z.enum(["percent", "percent_penalty"]),
      value: z.number().min(0).max(100),
    })
    .strict(),
  z
    .object({
      type: z.enum(["per_day", "per_day_penalty"]),
      value: z.number().min(0),
    })
    .strict(),
]);

export const createAssignmentSchema = z
  .object({
    title: z.string().min(1),
    descriptionMd: z.string().optional(),
    type: z.enum([
      "file",
      "link",
      "text",
      "quiz",
      "reading",
      "listening",
      "writing",
      "speaking",
    ]),
    dueAt: z.string().optional(),
    latePolicy: latePolicySchema.optional(),
    assignmentConfig: z.record(z.string(), z.unknown()).optional(),
    publishedAt: z.string().optional(),
  })
  .strict();

export const updateAssignmentSchema = z
  .object({
    title: z.string().min(1).optional(),
    descriptionMd: z.string().optional(),
    type: z
      .enum([
        "file",
        "link",
        "text",
        "quiz",
        "reading",
        "listening",
        "writing",
        "speaking",
      ])
      .optional(),
    dueAt: z.string().optional(),
    latePolicy: latePolicySchema.optional(),
    assignmentConfig: z.record(z.string(), z.unknown()).optional(),
    publishedAt: z.string().optional(),
  })
  .strict();

export type CreateAssignmentPayload = z.infer<typeof createAssignmentSchema>;
export type UpdateAssignmentPayload = z.infer<typeof updateAssignmentSchema>;
