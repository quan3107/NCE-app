/**
 * File: src/modules/nce-content/nce-content.schema.ts
 * Purpose: Validate NCE content route params and query options.
 * Why: Keeps read filters predictable before Prisma queries are built.
 */
import { z } from "zod";

const optionalBooleanQuery = z.preprocess((value) => {
  if (value === undefined) {
    return undefined;
  }
  if (value === "true" || value === true) {
    return true;
  }
  if (value === "false" || value === false) {
    return false;
  }
  return value;
}, z.boolean().optional());

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

export const nceBookParamsSchema = z.object({
  bookId: z.string().uuid(),
});

export const nceUnitParamsSchema = z.object({
  unitId: z.string().uuid(),
});

export const nceLessonParamsSchema = z.object({
  lessonId: z.string().uuid(),
});

export const courseNceLessonsParamsSchema = z.object({
  courseId: z.string().uuid(),
});

export const nceReadQuerySchema = z.object({
  includeDrafts: optionalBooleanQuery.default(false),
  courseId: z.string().uuid().optional(),
  page: positiveIntegerQuery(1, 10_000),
  pageSize: positiveIntegerQuery(20, 100),
});

export type NceReadQuery = z.infer<typeof nceReadQuerySchema>;
