/**
 * File: src/modules/ai-feedback/ai-feedback.generationJob.schema.ts
 * Purpose: Validate queued AI feedback generation job payloads.
 * Why: Persistence and workers must agree on payload shape before pg-boss dispatch.
 */
import { z } from "zod";

const providerTierSchema = z.enum(["auto", "low_cost", "premium"]);

const assignmentAiPolicySchema = z
  .object({
    writingFeedbackMode: z.string().optional(),
    objectiveExplanations: z.string().optional(),
    providerTier: providerTierSchema.optional(),
  })
  .passthrough();

const providerImageContentPartSchema = z.object({
  type: z.literal("image"),
  imageUrl: z.string(),
  mimeType: z.string(),
  detail: z.enum(["auto", "low", "high"]).optional(),
});

const writingImageContextSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("image_attached"),
    image: providerImageContentPartSchema,
    teacherSummary: z.string().optional(),
  }),
  z.object({
    status: z.literal("teacher_summary_supplemental"),
    teacherSummary: z.string(),
  }),
  z.object({
    status: z.enum(["image_unavailable", "fallback_only"]),
    reason: z.string(),
    teacherSummary: z.string().optional(),
  }),
]);

const writingPromptInputSchema = z
  .object({
    assignment: z
      .object({
        title: z.string(),
        type: z.literal("writing"),
        config: z
          .object({
            version: z.number().optional(),
            instructions: z.string().optional(),
            aiPolicy: assignmentAiPolicySchema.optional(),
          })
          .passthrough(),
      })
      .passthrough(),
    tasks: z
      .object({
        task1: z
          .object({
            prompt: z.string(),
            visualType: z.string().optional(),
            imageContext: writingImageContextSchema.optional(),
          })
          .passthrough(),
        task2: z
          .object({
            prompt: z.string(),
          })
          .passthrough(),
      })
      .passthrough(),
    submission: z
      .object({
        task1: z
          .object({
            text: z.string().optional(),
          })
          .passthrough()
          .optional(),
        task2: z
          .object({
            text: z.string().optional(),
          })
          .passthrough()
          .optional(),
      })
      .passthrough(),
    teacherConstraints: z.array(z.string()).optional(),
  })
  .passthrough();

const objectiveSourceContextSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.enum(["reading_passage", "listening_transcript"]),
      text: z.string(),
    })
    .passthrough(),
  z
    .object({
      kind: z.literal("listening_audio_file"),
      audioFileId: z.string(),
    })
    .passthrough(),
]);

const objectiveSourceEvidenceCandidateSchema = z
  .object({
    id: z.string().min(1),
    quote: z.string().min(1),
  })
  .passthrough();

const objectivePromptInputSchema = z
  .object({
    assignment: z
      .object({
        title: z.string(),
        type: z.enum(["reading", "listening"]),
        config: z
          .object({
            version: z.number().optional(),
            aiPolicy: assignmentAiPolicySchema.optional(),
          })
          .passthrough(),
      })
      .passthrough(),
    question: z
      .object({
        id: z.string(),
        text: z.string(),
        acceptedAnswer: z.string(),
      })
      .passthrough(),
    studentAnswer: z.unknown(),
    deterministicResult: z.string(),
    sourceContext: objectiveSourceContextSchema.optional(),
    sourceEvidenceCandidates: z
      .array(objectiveSourceEvidenceCandidateSchema)
      .optional(),
  })
  .passthrough();

export const writingGenerationHarnessInputSchema = z
  .object({
    fixtureId: z.string().min(1),
    taskType: z.literal("writing_feedback"),
    promptInput: writingPromptInputSchema,
    providerOutput: z.string().optional(),
    routeKey: z.string().min(1).optional(),
    allowVisualImageFallback: z.boolean().optional(),
  })
  .passthrough();

export const objectiveGenerationHarnessInputSchema = z
  .object({
    fixtureId: z.string().min(1),
    taskType: z.literal("objective_explanation"),
    promptInput: objectivePromptInputSchema,
    providerOutput: z.string().optional(),
    routeKey: z.string().min(1).optional(),
  })
  .passthrough();

export const writingGenerationJobSchema = z
  .object({
    harnessInput: writingGenerationHarnessInputSchema,
  })
  .strict();

export const objectiveGenerationJobSchema = z
  .object({
    harnessInput: objectiveGenerationHarnessInputSchema,
  })
  .strict();

export const writingDraftJobPayloadSchema = z
  .object({
    draftId: z.string().uuid(),
    harnessInput: writingGenerationHarnessInputSchema,
  })
  .strict();

export const objectiveExplanationJobPayloadSchema = z
  .object({
    explanationId: z.string().uuid(),
    harnessInput: objectiveGenerationHarnessInputSchema,
  })
  .strict();

export type WritingGenerationJobInput = z.infer<
  typeof writingGenerationJobSchema
>;
export type ObjectiveGenerationJobInput = z.infer<
  typeof objectiveGenerationJobSchema
>;
