/**
 * File: src/modules/grades/grades.schema.ts
 * Purpose: Provide schemas for grading endpoints.
 * Why: Enables consistent validation for grading workflows later.
 */
import { z } from "zod";

export const submissionScopedParamsSchema = z.object({
  submissionId: z.string().uuid(),
});

export const gradePayloadSchema = z
  .object({
    graderId: z.string().uuid(),
    rubricBreakdown: z.array(
      z.object({
        criterion: z.string(),
        points: z.number(),
      }),
    ).optional(),
    rawScore: z.number().min(0).optional(),
    adjustments: z
      .array(
        z.object({
          reason: z.string(),
          delta: z.number(),
        }),
      )
      .optional(),
    finalScore: z.number().min(0).optional(),
    band: z.number().min(0).optional(),
    feedbackMd: z.string().optional(),
  })
  .strict();
