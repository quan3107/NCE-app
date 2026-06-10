/**
 * File: src/modules/ai-feedback/ai-feedback.writing-feedback.support.ts
 * Purpose: Provide shared helpers for IELTS writing AI feedback orchestration.
 * Why: Keeps readiness, hashing, route metadata, and response mapping reusable.
 */
import { createHash } from "node:crypto";

import { createHttpError } from "../../utils/httpError.js";
import { aiFeedbackConfig } from "./ai-feedback.config.js";
import type { WritingFeedbackResponse } from "./ai-feedback.schema.js";
import type { AiConcreteProviderRouteKey } from "./provider.types.js";
import type { BuiltIeltsWritingFeedbackPrompt } from "./prompts/ielts-writing.js";
import type {
  WritingAssignmentConfig,
  WritingFeedbackDraftForResponse,
} from "./ai-feedback.writing-feedback.types.js";

export function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

export function sha256(value: unknown): string {
  return `sha256:${createHash("sha256").update(stableJson(value)).digest("hex")}`;
}

export function assertAiFeedbackGenerationReady(): void {
  if (!aiFeedbackConfig.enabled) {
    throw createHttpError(503, "AI feedback generation is disabled.");
  }

  if (!aiFeedbackConfig.apiKey) {
    throw createHttpError(503, "AI feedback provider is not configured.");
  }

  try {
    const baseUrl = new URL(aiFeedbackConfig.baseUrl);
    if (!["http:", "https:"].includes(baseUrl.protocol)) {
      throw new Error("Unsupported AI provider protocol.");
    }
  } catch {
    throw createHttpError(503, "AI feedback provider is not configured.");
  }
}

export function routeKeyForWritingFeedback(
  assignmentConfig: WritingAssignmentConfig,
): AiConcreteProviderRouteKey {
  return assignmentConfig.aiPolicy?.providerTier === "premium"
    ? "premium"
    : "low_cost";
}

export function modelForRouteKey(routeKey: AiConcreteProviderRouteKey): string {
  return routeKey === "low_cost"
    ? aiFeedbackConfig.routes.lowCost.model
    : aiFeedbackConfig.routes.premium.model;
}

export function reasoningEffortForRouteKey(
  routeKey: AiConcreteProviderRouteKey,
) {
  return routeKey === "low_cost"
    ? aiFeedbackConfig.routes.lowCost.reasoningEffort
    : aiFeedbackConfig.routes.premium.reasoningEffort;
}

export function visibilityModeForPolicy(
  assignmentConfig: WritingAssignmentConfig,
): "teacher_reviewed" | "instant_student_visible" {
  return assignmentConfig.aiPolicy?.writingFeedbackMode ===
    "instant_student_visible"
    ? "instant_student_visible"
    : "teacher_reviewed";
}

export function assertPromptInputWithinLimit(promptInput: unknown): void {
  const length = stableJson(promptInput).length;

  if (length > aiFeedbackConfig.maxInputChars) {
    throw createHttpError(413, "AI writing feedback input is too large.", {
      max_input_chars: aiFeedbackConfig.maxInputChars,
      input_chars: length,
    });
  }
}

export function imageUnavailableFeedback(
  prompt: BuiltIeltsWritingFeedbackPrompt,
) {
  return {
    status: "review_required",
    reason: prompt.imageContextFailure?.failureMessage,
    image_context: "unavailable",
  };
}

function pollingLocation(submissionId: string): string {
  return `/api/v1/submissions/${submissionId}/ai-feedback/writing`;
}

export function toWritingFeedbackResponse(
  draft: WritingFeedbackDraftForResponse,
): WritingFeedbackResponse {
  const active = draft.status === "queued" || draft.status === "running";
  const visibleFeedback =
    (draft.status === "accepted" ||
      draft.status === "approved" ||
      draft.status === "finalized" ||
      draft.status === "review_required" ||
      draft.status === "failed") &&
    draft.generatedFeedback &&
    typeof draft.generatedFeedback === "object" &&
    !Array.isArray(draft.generatedFeedback)
      ? (draft.generatedFeedback as Record<string, unknown>)
      : undefined;

  return {
    id: draft.id,
    status: draft.status as WritingFeedbackResponse["status"],
    visibilityMode: draft.visibilityMode,
    ...(active ? { pollingLocation: pollingLocation(draft.submissionId) } : {}),
    ...(visibleFeedback ? { feedback: visibleFeedback } : {}),
    ...(draft.failureCode ? { failureCode: draft.failureCode } : {}),
    ...(draft.failureMessage ? { failureMessage: draft.failureMessage } : {}),
  };
}
