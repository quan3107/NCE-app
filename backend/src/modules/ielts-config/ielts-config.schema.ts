/**
 * File: src/modules/ielts-config/ielts-config.schema.ts
 * Purpose: Zod validation schemas for IELTS domain configuration API
 * Why: Provides runtime validation and type inference for config endpoints
 */

import { z } from "zod";

// ============================================================================
// Individual Config Type Schemas
// ============================================================================

export const ieltsAssignmentTypeSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string().optional(),
  icon: z.string().optional(),
  enabled: z.boolean(),
  sort_order: z.number(),
});

export const ieltsQuestionTypeSchema = z.object({
  id: z.string(),
  skill_type: z.enum(["reading", "listening"]),
  label: z.string(),
  description: z.string().optional(),
  enabled: z.boolean(),
  sort_order: z.number(),
});

export const ieltsWritingTaskTypeSchema = z.object({
  id: z.string(),
  task_number: z.number(),
  label: z.string(),
  description: z.string().optional(),
  enabled: z.boolean(),
  sort_order: z.number(),
});

export const ieltsSpeakingPartTypeSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string().optional(),
  enabled: z.boolean(),
  sort_order: z.number(),
});

export const ieltsCompletionFormatSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string().optional(),
  enabled: z.boolean(),
  sort_order: z.number(),
});

export const ieltsSampleTimingOptionSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string().optional(),
  enabled: z.boolean(),
  sort_order: z.number(),
});

export const ieltsConfigVersionSchema = z.object({
  version: z.number(),
  name: z.string(),
  description: z.string().optional(),
  is_active: z.boolean(),
  activated_at: z.string().datetime().optional(),
  created_at: z.string().datetime(),
});

// ============================================================================
// Response Schemas
// ============================================================================

export const ieltsConfigResponseSchema = z.object({
  version: z.number(),
  assignment_types: z.array(ieltsAssignmentTypeSchema),
  question_types: z.object({
    reading: z.array(ieltsQuestionTypeSchema),
    listening: z.array(ieltsQuestionTypeSchema),
  }),
  writing_task_types: z.object({
    task1: z.array(ieltsWritingTaskTypeSchema),
    task2: z.array(ieltsWritingTaskTypeSchema),
  }),
  speaking_part_types: z.array(ieltsSpeakingPartTypeSchema),
  completion_formats: z.array(ieltsCompletionFormatSchema),
  sample_timing_options: z.array(ieltsSampleTimingOptionSchema),
});

export const ieltsConfigVersionsResponseSchema = z.object({
  versions: z.array(ieltsConfigVersionSchema),
  active_version: z.number(),
});

// ============================================================================
// Inferred Types
// ============================================================================

export type IeltsAssignmentType = z.infer<typeof ieltsAssignmentTypeSchema>;
export type IeltsQuestionType = z.infer<typeof ieltsQuestionTypeSchema>;
export type IeltsWritingTaskType = z.infer<typeof ieltsWritingTaskTypeSchema>;
export type IeltsSpeakingPartType = z.infer<typeof ieltsSpeakingPartTypeSchema>;
export type IeltsCompletionFormat = z.infer<typeof ieltsCompletionFormatSchema>;
export type IeltsSampleTimingOption = z.infer<typeof ieltsSampleTimingOptionSchema>;
export type IeltsConfigVersion = z.infer<typeof ieltsConfigVersionSchema>;
export type IeltsConfigResponse = z.infer<typeof ieltsConfigResponseSchema>;
export type IeltsConfigVersionsResponse = z.infer<typeof ieltsConfigVersionsResponseSchema>;
