/**
 * File: tests/modules/ai-feedback/provider.factory.test.ts
 * Purpose: Verify provider router construction from runtime config.
 * Why: Ensures hosted and local OpenAI-compatible routes stay config-driven.
 */
import { describe, expect, it, vi } from "vitest";

import type { AiFeedbackConfig } from "../../../src/config/env.js";
import { createAiProviderRouterFromConfig } from "../../../src/modules/ai-feedback/provider.factory.js";

const config = {
  enabled: true,
  provider: "openai-compatible",
  baseUrl: "https://hosted.example/v1",
  apiKey: "hosted-key",
  timeoutMs: 500,
  maxInputChars: 12_000,
  maxOutputTokens: 700,
  healthPath: "/models",
  routes: {
    local: {
      baseUrl: "http://localhost:11434/v1",
      apiKey: undefined,
      model: "llama3.1",
      reasoningEffort: "none",
      supportsReasoningEffort: false,
    },
    lowCost: {
      model: "gpt-5.4-nano",
      reasoningEffort: "medium",
    },
    premium: {
      model: "gpt-5.4-mini",
      reasoningEffort: "high",
    },
  },
} satisfies AiFeedbackConfig;

function jsonResponse(content: string): Response {
  return new Response(
    JSON.stringify({
      choices: [{ message: { content } }],
    }),
    {
      status: 200,
      headers: { "content-type": "application/json" },
    },
  );
}

describe("createAiProviderRouterFromConfig", () => {
  it("builds low-cost, premium, and local routes from config", async () => {
    const fetchImpl = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse("{}")));
    const router = createAiProviderRouterFromConfig(config, {
      fetch: fetchImpl,
      now: () => 1,
    });

    await router.generate({
      routeKey: "low_cost",
      taskType: "objective_explanation",
      messages: [{ role: "user", content: "Explain." }],
      expectJson: true,
    });
    await router.generate({
      routeKey: "local",
      taskType: "writing_feedback",
      messages: [{ role: "user", content: "Grade." }],
      expectJson: true,
    });

    expect(fetchImpl.mock.calls[0]?.[0]).toBe(
      "https://hosted.example/v1/chat/completions",
    );
    expect(JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body))).toMatchObject({
      model: "gpt-5.4-nano",
      reasoning_effort: "medium",
    });

    expect(fetchImpl.mock.calls[1]?.[0]).toBe(
      "http://localhost:11434/v1/chat/completions",
    );
    expect(JSON.parse(String(fetchImpl.mock.calls[1]?.[1]?.body))).toMatchObject({
      model: "llama3.1",
    });
    expect(
      JSON.parse(String(fetchImpl.mock.calls[1]?.[1]?.body)).reasoning_effort,
    ).toBeUndefined();
  });
});
