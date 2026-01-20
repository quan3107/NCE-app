/**
 * File: src/modules/rubrics/rubrics.schema.ts
 * Purpose: Validate incoming rubric requests for course-scoped endpoints.
 * Why: Keeps rubric payloads aligned with PRD expectations before persistence.
 */
import { z } from "zod";

export const courseScopedParamsSchema = z.object({
  courseId: z.string().uuid(),
});

const rubricLevelSchema = z
  .object({
    label: z.string().min(1),
    points: z.number(),
    desc: z.string().optional(),
  })
  .strict();

const rubricCriterionSchema = z
  .object({
    criterion: z.string().min(1),
    weight: z.number().positive(),
    levels: z.array(rubricLevelSchema).min(1),
  })
  .strict();

export const createRubricSchema = z
  .object({
    name: z.string().min(1),
    criteria: z.array(rubricCriterionSchema).min(1),
  })
  .strict();
