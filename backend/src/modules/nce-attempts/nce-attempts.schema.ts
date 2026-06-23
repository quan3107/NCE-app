/**
 * File: src/modules/nce-attempts/nce-attempts.schema.ts
 * Purpose: Validate NCE learning path and attempt route inputs.
 * Why: Keeps student progress mutations predictable before Prisma writes.
 */
import { z } from "zod";

const positiveIntegerQuery = (defaultValue: number, maxValue: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() !== "" ? Number(value) : value),
    z
      .number()
      .int()
      .min(1)
      .max(maxValue)
      .optional()
      .default(defaultValue),
  );

export const courseNcePathParamsSchema = z.object({
  courseId: z.string().uuid(),
});

export const courseNceExerciseParamsSchema = courseNcePathParamsSchema.extend({
  exerciseId: z.string().uuid(),
});

export const courseNceLessonParamsSchema = courseNcePathParamsSchema.extend({
  lessonId: z.string().uuid(),
});

export const nceAttemptParamsSchema = z.object({
  attemptId: z.string().uuid(),
});

export const ncePathQuerySchema = z.object({
  page: positiveIntegerQuery(1, 10_000),
  pageSize: positiveIntegerQuery(20, 100),
});

export const nceAttemptSummaryQuerySchema = ncePathQuerySchema.extend({
  studentId: z.string().uuid().optional(),
  lessonId: z.string().uuid().optional(),
});

export const nceAttemptWriteSchema = z.object({
  response: z.record(z.string(), z.unknown()),
});

export type NcePathQuery = z.infer<typeof ncePathQuerySchema>;
export type NceAttemptSummaryQuery = z.infer<typeof nceAttemptSummaryQuerySchema>;
export type NceAttemptWriteInput = z.infer<typeof nceAttemptWriteSchema>;
