/**
 * File: src/jobs/aiFeedbackJob.types.ts
 * Purpose: Share AI feedback job names, payloads, and dependency contracts.
 * Why: Keeps worker registration separate from job processing details.
 */
import type {
  ObjectiveExplanationHarnessInput,
  WritingFeedbackHarnessInput,
} from "../modules/ai-feedback/harness/harness.types.js";
import type { AiProviderRouter } from "../modules/ai-feedback/provider.router.js";

export const AI_FEEDBACK_JOB_NAMES = {
  generateWritingDraft: "ai-feedback.generate-writing-draft",
  generateObjectiveExplanation: "ai-feedback.generate-objective-explanation",
} as const;

export const AI_FEEDBACK_JOB_OPTIONS = {
  retryLimit: 3,
  retryDelay: 60,
  retryBackoff: true,
} as const;

export type WritingDraftJobPayload = {
  draftId: string;
  harnessInput: Omit<WritingFeedbackHarnessInput, "providerOutput"> & {
    providerOutput?: string;
  };
};

export type ObjectiveExplanationJobPayload = {
  explanationId: string;
  harnessInput: Omit<ObjectiveExplanationHarnessInput, "providerOutput"> & {
    providerOutput?: string;
  };
};

export type AiFeedbackJobDeps = {
  providerRouter?: Pick<AiProviderRouter, "generate">;
  now?: () => Date;
};
