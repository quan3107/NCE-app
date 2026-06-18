/**
 * File: src/modules/nce-content/nce-content.schema.ts
 * Purpose: Validate NCE content route params and query options.
 * Why: Keeps read filters predictable before Prisma queries are built.
 */
import { z } from "zod";
import { NceExerciseType } from "../../prisma/index.js";

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

export const nceLessonWriteParamsSchema = nceLessonParamsSchema.extend({
  courseId: z.string().uuid().optional(),
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

const jsonObjectSchema = z.record(z.string(), z.unknown());

const optionalDateSchema = z
  .string()
  .datetime()
  .nullable()
  .optional();

export const nceObjectiveWriteSchema = z.object({
  code: z.string().trim().min(1).max(120),
  title: z.string().trim().min(1).max(200),
  category: z.string().trim().min(1).max(80),
  description: z.string().trim().max(1000).nullable().optional(),
  masteryThreshold: z.number().int().min(1).max(100).default(80),
  sortOrder: z.number().int().min(0).default(0),
});

export const nceExerciseWriteSchema = z.object({
  objectiveId: z.string().uuid().nullable().optional(),
  objectiveCode: z.string().trim().min(1).max(120).optional(),
  exerciseType: z.nativeEnum(NceExerciseType),
  prompt: z.string().trim().min(1).max(2000),
  content: jsonObjectSchema,
  answerKey: jsonObjectSchema,
  scoringConfig: jsonObjectSchema.nullable().optional(),
  sortOrder: z.number().int().min(0).default(0),
});

export const createNceLessonSchema = z.object({
  unitId: z.string().uuid(),
  lessonNumber: z.number().int().min(1),
  title: z.string().trim().min(1).max(200),
  lessonText: z.string().trim().min(1),
  media: jsonObjectSchema.nullable().optional(),
  teacherNotes: z.string().trim().max(5000).nullable().optional(),
  sortOrder: z.number().int().min(0).default(0),
  objectives: z.array(nceObjectiveWriteSchema).default([]),
  exercises: z.array(nceExerciseWriteSchema).default([]),
});

export const patchNceLessonSchema = z.object({
  unitId: z.string().uuid().optional(),
  lessonNumber: z.number().int().min(1).optional(),
  title: z.string().trim().min(1).max(200).optional(),
  lessonText: z.string().trim().min(1).optional(),
  media: jsonObjectSchema.nullable().optional(),
  teacherNotes: z.string().trim().max(5000).nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
  objectives: z.array(nceObjectiveWriteSchema).optional(),
  exercises: z.array(nceExerciseWriteSchema).optional(),
});

export const assignNceLessonsSchema = z.object({
  lessons: z
    .array(
      z.object({
        lessonId: z.string().uuid(),
        sequence: z.number().int().min(1),
        availableFrom: optionalDateSchema,
        dueAt: optionalDateSchema,
      }),
    )
    .default([]),
});

export type CreateNceLessonInput = z.infer<typeof createNceLessonSchema>;
export type PatchNceLessonInput = z.infer<typeof patchNceLessonSchema>;
export type AssignNceLessonsInput = z.infer<typeof assignNceLessonsSchema>;
