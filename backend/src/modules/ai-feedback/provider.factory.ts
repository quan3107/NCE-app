/**
 * File: src/modules/ai-feedback/provider.factory.ts
 * Purpose: Build the configured AI provider router for app services.
 * Why: Keeps provider construction centralized and model settings config-driven.
 */
import type { AiFeedbackConfig } from "../../config/env.js";
import { aiFeedbackConfig } from "./ai-feedback.config.js";
import { OpenAIProvider } from "./provider.openai.js";
import { createAiProviderRouter, type AiProviderRouter } from "./provider.router.js";
import type {
  AiConcreteProviderRouteKey,
  AiProviderHealthState,
  AiProviderRouteConfig,
} from "./provider.types.js";

type FactoryOptions = {
  fetch?: typeof fetch;
  now?: () => number;
  health?: Partial<Record<AiConcreteProviderRouteKey, AiProviderHealthState>>;
};

export function createAiProviderRouterFromConfig(
  config: AiFeedbackConfig = aiFeedbackConfig,
  options: FactoryOptions = {},
): AiProviderRouter {
  const sharedOptions = {
    timeoutMs: config.timeoutMs,
    maxOutputTokens: config.maxOutputTokens,
    fetch: options.fetch,
    now: options.now,
  };

  return createAiProviderRouter({
    health: options.health,
    providers: {
      low_cost: new OpenAIProvider({
        ...hostedRouteConfig(config, "low_cost"),
        ...sharedOptions,
      }),
      premium: new OpenAIProvider({
        ...hostedRouteConfig(config, "premium"),
        ...sharedOptions,
      }),
    },
  });
}

function hostedRouteConfig(
  config: AiFeedbackConfig,
  routeKey: "low_cost" | "premium",
): Omit<
  AiProviderRouteConfig,
  "timeoutMs" | "maxOutputTokens" | "maxResponseBytes"
> {
  const route =
    routeKey === "low_cost" ? config.routes.lowCost : config.routes.premium;

  return {
    routeKey,
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    model: route.model,
    reasoningEffort: route.reasoningEffort,
    supportsReasoningEffort: true,
  };
}
