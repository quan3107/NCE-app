/**
 * File: tests/modules/ai-feedback/ai-feedback.service.test.ts
 * Purpose: Verify AI feedback configuration health state reporting.
 * Why: Keeps provider readiness visible without exposing secrets or blocking app startup.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AiFeedbackConfig } from "../../../src/config/env.js";

vi.mock("../../../src/config/logger.js", () => ({
  logger: {
    warn: vi.fn(),
  },
}));

const { getAiFeedbackHealth } = await import(
  "../../../src/modules/ai-feedback/ai-feedback.service.js"
);

const baseConfig = {
  enabled: true,
  provider: "openai-compatible",
  baseUrl: "https://api-key:secret@example.com/v1?api_key=raw-secret&keep=yes",
  apiKey: "sk-test-secret",
  timeoutMs: 250,
  maxInputChars: 12_000,
  maxOutputTokens: 1_200,
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

function response(status: number): Response {
  return { ok: status >= 200 && status < 300, status } as Response;
}

describe("ai-feedback.service", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("reports disabled without probing the provider", async () => {
    const probe = vi.fn();

    const health = await getAiFeedbackHealth(
      { ...baseConfig, enabled: false, apiKey: undefined },
      { probe },
    );

    expect(health.status).toBe("disabled");
    expect(health.enabled).toBe(false);
    expect(health.routes.low_cost.model).toBe("gpt-5.4-nano");
    expect(health.routes.premium.reasoning_effort).toBe("high");
    expect(probe).not.toHaveBeenCalled();
  });

  it("reports misconfigured when enabled without an API key", async () => {
    const health = await getAiFeedbackHealth(
      { ...baseConfig, apiKey: undefined },
      { probe: vi.fn() },
    );

    expect(health.status).toBe("misconfigured");
    expect(health.problem).toBe("AI_API_KEY is required when AI feedback is enabled.");
    expect(JSON.stringify(health)).not.toContain("sk-test-secret");
  });

  it("redacts credentials and sensitive query parameters from provider metadata", async () => {
    const health = await getAiFeedbackHealth(baseConfig, {
      probe: vi.fn().mockResolvedValue(response(200)),
    });

    expect(health.status).toBe("healthy");
    expect(health.provider.base_url).toBe(
      "https://REDACTED:REDACTED@example.com/v1?api_key=REDACTED&keep=yes",
    );
    expect(JSON.stringify(health)).not.toContain("raw-secret");
    expect(JSON.stringify(health)).not.toContain("sk-test-secret");
  });

  it("reports unhealthy when the provider health path returns a non-2xx status", async () => {
    const health = await getAiFeedbackHealth(baseConfig, {
      probe: vi.fn().mockResolvedValue(response(503)),
    });

    expect(health.status).toBe("unhealthy");
    expect(health.provider.http_status).toBe(503);
  });

  it("reports timeout when the provider probe exceeds the configured timeout", async () => {
    vi.useFakeTimers();
    const pendingHealth = getAiFeedbackHealth(baseConfig, {
      probe: () => new Promise<Response>(() => undefined),
    });

    await vi.advanceTimersByTimeAsync(251);

    await expect(pendingHealth).resolves.toMatchObject({
      status: "timeout",
      problem: "Provider health check timed out.",
    });
  });

  it("reports configured when no provider health path is configured", async () => {
    const probe = vi.fn();

    const health = await getAiFeedbackHealth(
      { ...baseConfig, healthPath: "" },
      { probe },
    );

    expect(health.status).toBe("configured");
    expect(health.problem).toBeUndefined();
    expect(probe).not.toHaveBeenCalled();
  });
});
