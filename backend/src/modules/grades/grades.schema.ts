/**
 * File: src/modules/grades/grades.schema.ts
 * Purpose: Provide schemas for grading endpoints.
 * Why: Enables consistent validation for grading workflows later.
 */
import { z } from "zod";

const gradeBandSchema = z
  .number()
  .min(0)
  .max(9)
  .refine((value) => Math.abs(value * 2 - Math.round(value * 2)) < 0.00001, {
    message: "Band must use valid 0.5 increments.",
  });

export const submissionScopedParamsSchema = z.object({
  submissionId: z.string().uuid(),
});

export const gradePayloadSchema = z
  .object({
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
    band: gradeBandSchema.optional(),
    feedbackMd: z.string().optional(),
  })
  .strict();
