/**
 * File: tests/modules/ai-feedback/ai-feedback.expansion-hooks.test.ts
 * Purpose: Verify post-release AI feedback expansion contracts stay disabled and advisory by default.
 * Why: PR-39 adds future hooks without enabling punitive or runtime verifier behavior.
 */
import { describe, expect, it } from "vitest";

import {
  buildNcePromptBuilderContext,
  type NcePromptBuilderInput,
} from "../../../src/modules/ai-feedback/prompts/nce.js";
import {
  createHostedImageContentPart,
  type AiVisualSummaryPipelineInput,
} from "../../../src/modules/ai-feedback/multimodal/index.js";
import {
  createAuthenticitySignal,
  type AuthenticitySignalInput,
} from "../../../src/modules/ai-feedback/authenticity/index.js";
import {
  buildEvaluationHookConfig,
  DEFAULT_EVALUATION_HOOK_FLAGS,
} from "../../../src/modules/ai-feedback/evaluation/index.js";

describe("ai feedback expansion hooks", () => {
  it("builds NCE prompt context from plain typed inputs", () => {
    const input: NcePromptBuilderInput = {
      level: "book_2",
      unit: "Unit 12",
      objectiveId: "past-perfect-recognition",
      objectiveLabel: "Recognize past perfect forms",
      learnerAnswer: "I had finished my homework before dinner.",
      targetLanguage: ["had finished", "before dinner"],
    };

    expect(buildNcePromptBuilderContext(input)).toEqual({
      source: "nce",
      level: "book_2",
      unit: "Unit 12",
      objective: {
        id: "past-perfect-recognition",
        label: "Recognize past perfect forms",
      },
      learnerAnswer: "I had finished my homework before dinner.",
      targetLanguage: ["had finished", "before dinner"],
    });
  });

  it("keeps provider-specific hosted images explicit for future multimodal routes", () => {
    const part = createHostedImageContentPart({
      provider: "openai-compatible",
      url: "https://storage.example/task-1.png",
      mimeType: "image/png",
      detail: "high",
    });
    const pipeline: AiVisualSummaryPipelineInput = {
      source: "teacher_authored",
      assignmentId: "22222222-2222-4222-8222-222222222222",
      imageContextValidated: true,
      summaryMd: "The line chart rises steadily from 2010 to 2020.",
    };

    expect(part).toEqual({
      type: "provider_hosted_image",
      provider: "openai-compatible",
      imageUrl: "https://storage.example/task-1.png",
      mimeType: "image/png",
      detail: "high",
    });
    expect(pipeline.imageContextValidated).toBe(true);
  });

  it("marks authenticity signals as teacher-visible and non-punitive by default", () => {
    const input: AuthenticitySignalInput = {
      kind: "copied_prompt_text",
      confidence: 0.82,
      evidence: "Large overlap with assignment prompt.",
    };

    expect(createAuthenticitySignal(input)).toEqual({
      kind: "copied_prompt_text",
      confidence: 0.82,
      evidence: "Large overlap with assignment prompt.",
      visibility: "teacher_only",
      severity: "advisory",
      punitive: false,
    });
  });

  it("keeps verifier, calibration, shadow evaluation, and live benchmarks disabled", () => {
    expect(DEFAULT_EVALUATION_HOOK_FLAGS).toEqual({
      verifier: false,
      uncertainty: false,
      calibration: false,
      shadowEvaluation: false,
      liveProviderBenchmarks: false,
    });
    expect(buildEvaluationHookConfig({ verifier: true })).toEqual({
      verifier: true,
      uncertainty: false,
      calibration: false,
      shadowEvaluation: false,
      liveProviderBenchmarks: false,
    });
  });
});
