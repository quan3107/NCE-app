/**
 * File: tests/modules/ai-feedback/provider.openai.test.ts
 * Purpose: Verify server-side OpenAI chat completion provider behavior.
 * Why: Keeps downstream AI services independent from OpenAI request details.
 */
import { describe, expect, it, vi } from "vitest";

import { AiProviderError } from "../../../src/modules/ai-feedback/provider.errors.js";
import { OpenAIProvider } from "../../../src/modules/ai-feedback/provider.openai.js";
import type { AiProviderRequest } from "../../../src/modules/ai-feedback/provider.types.js";

const baseRequest = {
  taskType: "objective_explanation",
  messages: [
    { role: "system", content: "Return JSON." },
    { role: "user", content: "Explain this objective." },
  ],
  expectJson: true,
} satisfies AiProviderRequest;

function provider(
  fetchImpl: typeof fetch,
  overrides: Partial<ConstructorParameters<typeof OpenAIProvider>[0]> = {},
): OpenAIProvider {
  return new OpenAIProvider({
    routeKey: "low_cost",
    baseUrl: "https://provider.example/v1",
    apiKey: "sk-test",
    model: "gpt-5.4-nano",
    reasoningEffort: "medium",
    supportsReasoningEffort: true,
    timeoutMs: 500,
    maxOutputTokens: 600,
    maxResponseBytes: 4096,
    fetch: fetchImpl,
    now: () => 1_000,
    ...overrides,
  });
}

function jsonResponse(
  body: unknown,
  init: { status?: number; headers?: Record<string, string> } = {},
): Response {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json");

  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers,
  });
}

describe("OpenAIProvider", () => {
  it("posts chat completions with model, reasoning effort, JSON instructions, and returns parsed metadata", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(
        {
          model: "gpt-5.4-nano",
          choices: [
            {
              message: {
                content: '{"summary":"Use articles with singular count nouns."}',
              },
            },
          ],
          usage: {
            prompt_tokens: 12,
            completion_tokens: 8,
            total_tokens: 20,
          },
        },
        { headers: { "x-request-id": "req_123" } },
      ),
    );

    const result = await provider(fetchImpl).generate(baseRequest);

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://provider.example/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          authorization: "Bearer sk-test",
          accept: "application/json",
          "content-type": "application/json",
        }),
      }),
    );

    const body = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body));
    expect(body).toMatchObject({
      model: "gpt-5.4-nano",
      reasoning_effort: "medium",
      max_tokens: 600,
      response_format: { type: "json_object" },
    });
    expect(body.messages).toEqual([
      { role: "system", content: "Return JSON." },
      { role: "user", content: "Explain this objective." },
    ]);

    expect(result).toMatchObject({
      rawText: '{"summary":"Use articles with singular count nouns."}',
      parsedJson: { summary: "Use articles with singular count nouns." },
      model: "gpt-5.4-nano",
      routeKey: "low_cost",
      latencyMs: expect.any(Number),
      providerRequestId: "req_123",
      tokenUsage: {
        promptTokens: 12,
        completionTokens: 8,
        totalTokens: 20,
      },
    });
  });

  it("accepts structured content arrays from provider responses", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        choices: [
          {
            message: {
              content: [
                { type: "text", text: '{"score":' },
                { type: "output_text", text: "7}" },
              ],
            },
          },
        ],
      }),
    );

    const result = await provider(fetchImpl).generate({
      ...baseRequest,
      taskType: "writing_feedback",
    });

    expect(result.rawText).toBe('{"score":7}');
    expect(result.parsedJson).toEqual({ score: 7 });
  });

  it("omits reasoning effort for providers that do not support it", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        choices: [{ message: { content: "plain feedback" } }],
      }),
    );

    await provider(fetchImpl, {
      routeKey: "low_cost",
      supportsReasoningEffort: false,
      reasoningEffort: "none",
    }).generate({
      ...baseRequest,
      expectJson: false,
    });

    const body = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body));
    expect(body.reasoning_effort).toBeUndefined();
  });

  it.each([
    ["missing_model", { model: "" }],
    [
      "unsupported_reasoning_effort",
      { reasoningEffort: "xhigh", supportsReasoningEffort: false },
    ],
  ] as const)("rejects invalid request config: %s", async (code, overrides) => {
    await expect(
      provider(vi.fn(), overrides).generate(baseRequest),
    ).rejects.toMatchObject({
      code,
    });
  });

  it.each([
    [
      "http_error",
      () => ({
        response: jsonResponse({ error: { message: "rate limited" } }, { status: 429 }),
      }),
    ],
    ["malformed_json", () => ({ response: new Response("{", { status: 200 }) })],
    [
      "empty_content",
      () => ({ response: jsonResponse({ choices: [{ message: { content: "" } }] }) }),
    ],
    [
      "response_too_large",
      () => ({
        response: jsonResponse({ choices: [{ message: { content: "x".repeat(40) } }] }),
        maxResponseBytes: 32,
      }),
    ],
  ] as const)("normalizes provider response failures: %s", async (code, responseFactory) => {
    const failure = responseFactory();

    await expect(
      provider(vi.fn().mockResolvedValue(failure.response), {
        maxResponseBytes: failure.maxResponseBytes,
      }).generate(baseRequest),
    ).rejects.toMatchObject({
      code,
    });
  });

  it("maps non-JSON provider error responses to retryable HTTP errors", async () => {
    await expect(
      provider(
        vi.fn().mockResolvedValue(
          new Response("Too many requests", {
            status: 429,
            headers: { "content-type": "text/plain" },
          }),
        ),
      ).generate(baseRequest),
    ).rejects.toMatchObject({
      code: "http_error",
      retryable: true,
      details: { status: 429 },
    });
  });

  it.each([
    [
      "timeout",
      () => Object.assign(new Error("aborted"), { name: "AbortError" }),
    ],
    [
      "connection_refused",
      () => Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" }),
    ],
  ] as const)("normalizes network failures: %s", async (code, errorFactory) => {
    await expect(
      provider(vi.fn().mockRejectedValue(errorFactory())).generate(baseRequest),
    ).rejects.toMatchObject({
      code,
    });
  });

  it("exposes stable provider errors for app-level handling", () => {
    const error = new AiProviderError({
      code: "empty_content",
      message: "Provider returned empty content.",
      routeKey: "premium",
      retryable: true,
    });

    expect(error.name).toBe("AiProviderError");
    expect(error.statusCode).toBe(502);
    expect(error.retryable).toBe(true);
  });
});
