/**
 * File: tests/modules/ai-feedback/image-routing.integration.test.ts
 * Purpose: Verify Task 1 image context flows through prompt routing and provider payload mapping.
 * Why: Protects the backend-only path that sends hosted image input to image-capable AI routes.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("../../../src/modules/files/files.service.js", () => ({
  getFileContentLocation: vi.fn(),
}));

const filesService = await import("../../../src/modules/files/files.service.js");
const { resolveAiFeedbackImageContext } = await import(
  "../../../src/modules/ai-feedback/image-context.js"
);
const { buildIeltsWritingFeedbackPrompt } = await import(
  "../../../src/modules/ai-feedback/prompts/ielts-writing.js"
);
const { OpenAIProvider } = await import(
  "../../../src/modules/ai-feedback/provider.openai.js"
);
const { createAiProviderRouter } = await import(
  "../../../src/modules/ai-feedback/provider.router.js"
);

const getFileContentLocation = vi.mocked(filesService.getFileContentLocation);

const actor = {
  id: "11111111-1111-4111-8111-111111111111",
  role: "teacher",
  status: "active",
} as const;

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

function provider(
  routeKey: "low_cost" | "premium",
  fetchImpl: typeof fetch,
): OpenAIProvider {
  return new OpenAIProvider({
    routeKey,
    baseUrl: "https://api.openai.com/v1",
    apiKey: "hosted-test-key",
    model: `${routeKey}-model`,
    reasoningEffort: "none",
    supportsReasoningEffort: true,
    supportsImageInput: routeKey === "premium",
    timeoutMs: 500,
    maxOutputTokens: 700,
    maxResponseBytes: 4096,
    fetch: fetchImpl,
    now: () => 1,
  });
}

describe("Task 1 image feedback routing integration", () => {
  it("routes backend-validated Task 1 images to an image-capable provider payload", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse('{"ok":true}'));
    getFileContentLocation.mockResolvedValue({
      url: "https://storage.mock/nce/task1-chart.png",
      mime: "image/png",
      size: 1024,
    });

    const image = await resolveAiFeedbackImageContext(
      "22222222-2222-4222-8222-222222222222",
      actor,
      {
        supportedMimeTypes: ["image/png"],
        maxBytes: 2048,
      },
    );
    const prompt = buildIeltsWritingFeedbackPrompt({
      assignment: {
        title: "Academic Writing Set A",
        type: "writing",
        config: {
          version: 1,
          aiPolicy: {
            writingFeedbackMode: "teacher_reviewed",
            objectiveExplanations: "off",
            providerTier: "auto",
          },
        },
      },
      tasks: {
        task1: {
          prompt: "Summarise the chart showing commuter trends.",
          imageContext: {
            status: "image_attached",
            image,
          },
        },
        task2: {
          prompt: "Discuss both views and give your own opinion.",
        },
      },
      submission: {
        task1: {
          text: "The chart shows commuter choices changing over time.",
        },
        task2: {
          text: "Public transport can reduce congestion in cities.",
        },
      },
    });
    const router = createAiProviderRouter({
      providers: {
        low_cost: provider("low_cost", fetchImpl),
        premium: provider("premium", fetchImpl),
      },
      health: {
        low_cost: "healthy",
        premium: "healthy",
      },
    });

    const result = await router.generate(prompt.request);

    expect(result.routeKey).toBe("premium");
    expect(fetchImpl).toHaveBeenCalledOnce();

    const body = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body));
    expect(body.model).toBe("premium-model");
    expect(body.messages[1]).toEqual({
      role: "user",
      content: [
        expect.objectContaining({ type: "text" }),
        {
          type: "image_url",
          image_url: {
            url: "https://storage.mock/nce/task1-chart.png",
            detail: "high",
          },
        },
      ],
    });
  });
});
