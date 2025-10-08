/**
 * File: src/modules/courses/courses.schema.ts
 * Purpose: Define schemas for course CRUD endpoints.
 * Why: Standardizes validation logic for course operations as they come online.
 */
import { z } from "zod";

export const courseIdParamsSchema = z.object({
  courseId: z.string().uuid(),
});

export const createCourseSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  ownerTeacherId: z.string().uuid(),
  schedule: z.record(z.string(), z.unknown()).optional(),
});
