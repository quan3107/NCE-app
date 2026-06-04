/**
 * File: src/modules/ai-feedback/provider.types.ts
 * Purpose: Define provider-neutral AI feedback request and response contracts.
 * Why: Keeps grading and explanation services independent from specific model vendors.
 */
import type { AiReasoningEffort } from "../../config/env.js";

export type AiConcreteProviderRouteKey = "local" | "low_cost" | "premium";
export type AiProviderRouteKey = AiConcreteProviderRouteKey | "auto";
export type AiTaskType = "writing_feedback" | "objective_explanation";
export type AiProviderHealthState = "healthy" | "configured" | "unhealthy" | "timeout";

export type AiProviderMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type AiAssignmentPolicy = {
  highStakes?: boolean;
  preferredRoute?: AiConcreteProviderRouteKey;
};

export type AiRetryState = {
  attempt: number;
  lowConfidence?: boolean;
};

export type AiProviderRequest = {
  routeKey?: AiProviderRouteKey;
  taskType: AiTaskType;
  messages: AiProviderMessage[];
  assignmentPolicy?: AiAssignmentPolicy;
  retry?: AiRetryState;
  expectJson?: boolean;
  temperature?: number;
  maxOutputTokens?: number;
};

export type AiProviderTokenUsage = {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
};

export type AiProviderResult = {
  rawText: string;
  parsedJson?: unknown;
  model: string;
  routeKey: AiConcreteProviderRouteKey;
  latencyMs: number;
  tokenUsage?: AiProviderTokenUsage;
  providerRequestId?: string;
  request?: AiProviderRequest;
};

export type AiProvider = {
  routeKey: AiConcreteProviderRouteKey;
  generate(request: AiProviderRequest): Promise<AiProviderResult>;
};

export type AiProviderRouteConfig = {
  routeKey: AiConcreteProviderRouteKey;
  baseUrl: string;
  apiKey?: string;
  model: string;
  reasoningEffort: AiReasoningEffort;
  supportsReasoningEffort: boolean;
  timeoutMs: number;
  maxOutputTokens: number;
  maxResponseBytes?: number;
};

