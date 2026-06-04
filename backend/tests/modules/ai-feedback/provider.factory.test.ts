/**
 * File: tests/modules/ai-feedback/provider.factory.test.ts
 * Purpose: Verify provider router construction from runtime config.
 * Why: Ensures hosted OpenAI routes stay config-driven and server-side.
 */
import { describe, expect, it, vi } from "vitest";

import type { AiFeedbackConfig } from "../../../src/config/env.js";
import { createAiProviderRouterFromConfig } from "../../../src/modules/ai-feedback/provider.factory.js";

const config = {
  enabled: true,
  provider: "openai-compatible",
  baseUrl: "https://api.openai.com/v1",
  apiKey: "hosted-key",
  timeoutMs: 500,
  maxInputChars: 12_000,
  maxOutputTokens: 700,
  healthPath: "/models",
  routes: {
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
  it("builds low-cost and premium server-side OpenAI routes from config", async () => {
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
      routeKey: "premium",
      taskType: "writing_feedback",
      messages: [{ role: "user", content: "Grade." }],
      expectJson: true,
    });

    expect(fetchImpl.mock.calls[0]?.[0]).toBe(
      "https://api.openai.com/v1/chat/completions",
    );
    expect(JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body))).toMatchObject({
      model: "gpt-5.4-nano",
      reasoning_effort: "medium",
    });

    expect(fetchImpl.mock.calls[1]?.[0]).toBe(
      "https://api.openai.com/v1/chat/completions",
    );
    expect(JSON.parse(String(fetchImpl.mock.calls[1]?.[1]?.body))).toMatchObject({
      model: "gpt-5.4-mini",
      reasoning_effort: "high",
    });

    const headers = fetchImpl.mock.calls.map((call) => call[1]?.headers);
    expect(headers).toEqual([
      expect.objectContaining({ authorization: "Bearer hosted-key" }),
      expect.objectContaining({ authorization: "Bearer hosted-key" }),
    ]);
  });
});
