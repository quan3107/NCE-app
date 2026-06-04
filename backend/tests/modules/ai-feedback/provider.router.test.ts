/**
 * File: tests/modules/ai-feedback/provider.router.test.ts
 * Purpose: Verify AI provider route selection and delegation.
 * Why: Keeps model routing policy out of downstream grading and explanation services.
 */
import { describe, expect, it, vi } from "vitest";

import { createAiProviderRouter } from "../../../src/modules/ai-feedback/provider.router.js";
import type {
  AiConcreteProviderRouteKey,
  AiProvider,
  AiProviderRequest,
  AiProviderResult,
} from "../../../src/modules/ai-feedback/provider.types.js";

const baseRequest = {
  taskType: "writing_feedback",
  messages: [{ role: "user", content: "Grade this writing." }],
  expectJson: true,
} satisfies AiProviderRequest;

function provider(routeKey: AiConcreteProviderRouteKey): AiProvider {
  return {
    routeKey,
    generate: vi.fn(async (request: AiProviderRequest): Promise<AiProviderResult> => ({
      rawText: "{}",
      parsedJson: {},
      model: `${routeKey}-model`,
      routeKey,
      latencyMs: 5,
      tokenUsage: undefined,
      providerRequestId: undefined,
      request,
    })),
  };
}

function router(options: Partial<Parameters<typeof createAiProviderRouter>[0]> = {}) {
  const providers = {
    low_cost: provider("low_cost"),
    premium: provider("premium"),
  };

  return {
    providers,
    router: createAiProviderRouter({
      providers,
      health: {
        low_cost: "healthy",
        premium: "healthy",
      },
      ...options,
    }),
  };
}

describe("createAiProviderRouter", () => {
  it("routes objective explanations and first-pass writing feedback to low cost by default", async () => {
    const setup = router();

    await setup.router.generate({
      ...baseRequest,
      routeKey: "auto",
      taskType: "objective_explanation",
    });
    await setup.router.generate({ ...baseRequest, routeKey: "auto" });

    expect(setup.providers.low_cost.generate).toHaveBeenCalledTimes(2);
    expect(setup.providers.premium.generate).not.toHaveBeenCalled();
  });

  it("routes high-stakes, premium policy, and low-confidence retry requests to premium", async () => {
    const setup = router();

    await setup.router.generate({
      ...baseRequest,
      routeKey: "auto",
      assignmentPolicy: { highStakes: true },
    });
    await setup.router.generate({
      ...baseRequest,
      routeKey: "auto",
      assignmentPolicy: { preferredRoute: "premium" },
    });
    await setup.router.generate({
      ...baseRequest,
      routeKey: "auto",
      retry: { attempt: 1, lowConfidence: true },
    });

    expect(setup.providers.premium.generate).toHaveBeenCalledTimes(3);
  });

  it("falls back from an unhealthy preferred premium route to low cost", async () => {
    const setup = router({
      health: {
        low_cost: "healthy",
        premium: "unhealthy",
      },
    });

    const result = await setup.router.generate({
      ...baseRequest,
      routeKey: "auto",
      assignmentPolicy: { preferredRoute: "premium" },
    });

    expect(result.routeKey).toBe("low_cost");
    expect(setup.providers.low_cost.generate).toHaveBeenCalledOnce();
  });

  it("delegates explicit concrete route keys without auto policy resolution", async () => {
    const setup = router();

    const result = await setup.router.generate({
      ...baseRequest,
      routeKey: "premium",
    });

    expect(result.routeKey).toBe("premium");
    expect(setup.providers.premium.generate).toHaveBeenCalledOnce();
  });
});
