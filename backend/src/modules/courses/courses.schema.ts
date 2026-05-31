/**
 * File: src/modules/courses/courses.schema.ts
 * Purpose: Define schemas for course CRUD endpoints.
 * Why: Standardizes validation logic for course operations as they come online.
 */
import { z } from "zod";

export const courseIdParamsSchema = z.object({
  courseId: z.string().uuid(),
});

export const courseStudentParamsSchema = courseIdParamsSchema.extend({
  studentId: z.string().uuid(),
});

export const courseListQuerySchema = z.object({
  status: z.enum(["active", "archived", "all"]).optional(),
  includeArchived: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .optional()
    .transform((value) => value === true || value === "true"),
});

export const createCourseSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  ownerTeacherId: z.string().uuid(),
  schedule: z.record(z.string(), z.unknown()).optional(),
});

export const updateCourseSchema = z
  .object({
    title: z.string().min(1).optional(),
    description: z.string().nullable().optional(),
    learningOutcomes: z.unknown().optional(),
    structureSummary: z.string().nullable().optional(),
    prerequisitesSummary: z.string().nullable().optional(),
    schedule: z.record(z.string(), z.unknown()).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one editable course field is required.",
  });

export const addCourseStudentSchema = z.object({
  email: z.string().email(),
});
