/**
 * File: src/modules/rubric-templates/rubric-templates.schema.ts
 * Purpose: Validate request params and query strings for rubric template endpoints.
 * Why: Keeps template APIs predictable and avoids duplicated parsing logic in controllers.
 */
import { z } from "zod";

export const rubricTemplateContextSchema = z.enum([
  "course",
  "assignment",
  "grading",
]);

export const rubricTemplateAssignmentTypeSchema = z.enum([
  "reading",
  "listening",
  "writing",
  "speaking",
  "generic",
]);

export type RubricTemplateContext = z.infer<typeof rubricTemplateContextSchema>;
export type RubricTemplateAssignmentType = z.infer<
  typeof rubricTemplateAssignmentTypeSchema
>;

export const defaultRubricsQuerySchema = z
  .object({
    context: rubricTemplateContextSchema,
    assignmentType: rubricTemplateAssignmentTypeSchema.optional(),
  })
  .strict();

export const rubricTemplatesQuerySchema = z
  .object({
    courseId: z.string().uuid(),
    context: rubricTemplateContextSchema.optional(),
  })
  .strict();

export const courseDefaultRubricTemplateParamsSchema = z.object({
  courseId: z.string().uuid(),
});
