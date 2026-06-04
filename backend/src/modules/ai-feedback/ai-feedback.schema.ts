/**
 * File: src/modules/ai-feedback/ai-feedback.schema.ts
 * Purpose: Define AI feedback health endpoint response contracts.
 * Why: Prevents provider readiness responses from drifting or leaking secrets.
 */
import { z } from "zod";

export const aiFeedbackHealthStatusSchema = z.enum([
  "disabled",
  "configured",
  "healthy",
  "unhealthy",
  "timeout",
  "misconfigured",
]);

export const aiReasoningEffortResponseSchema = z.enum([
  "none",
  "low",
  "medium",
  "high",
  "xhigh",
]);

const aiRouteMetadataSchema = z.object({
  model: z.string().min(1),
  reasoning_effort: aiReasoningEffortResponseSchema,
});

export const aiFeedbackHealthResponseSchema = z.object({
  status: aiFeedbackHealthStatusSchema,
  enabled: z.boolean(),
  checked_at: z.string().datetime(),
  provider: z.object({
    name: z.string().min(1),
    base_url: z.string().min(1),
    health_path: z.string(),
    http_status: z.number().int().optional(),
  }),
  limits: z.object({
    timeout_ms: z.number().int().positive(),
    max_input_chars: z.number().int().positive(),
    max_output_tokens: z.number().int().positive(),
  }),
  routes: z.object({
    low_cost: aiRouteMetadataSchema,
    premium: aiRouteMetadataSchema,
  }),
  problem: z.string().optional(),
});

export type AiFeedbackHealthStatus = z.infer<
  typeof aiFeedbackHealthStatusSchema
>;
export type AiFeedbackHealthResponse = z.infer<
  typeof aiFeedbackHealthResponseSchema
>;
