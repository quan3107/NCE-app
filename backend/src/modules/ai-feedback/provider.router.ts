/**
 * File: src/modules/ai-feedback/provider.router.ts
 * Purpose: Resolve AI feedback provider routes and delegate generation calls.
 * Why: Keeps task, policy, health, and retry routing decisions out of downstream services.
 */
import { AiProviderError } from "./provider.errors.js";
import type {
  AiConcreteProviderRouteKey,
  AiProvider,
  AiProviderHealthState,
  AiProviderRequest,
  AiProviderResult,
} from "./provider.types.js";

type ProvidersByRoute = Record<AiConcreteProviderRouteKey, AiProvider>;
type HealthByRoute = Record<AiConcreteProviderRouteKey, AiProviderHealthState>;

type RouterOptions = {
  providers: ProvidersByRoute;
  health?: Partial<HealthByRoute>;
};

export type AiProviderRouter = {
  generate(request: AiProviderRequest): Promise<AiProviderResult>;
  resolveRoute(request: AiProviderRequest): AiConcreteProviderRouteKey;
};

export function createAiProviderRouter(options: RouterOptions): AiProviderRouter {
  return {
    resolveRoute(request) {
      return resolveRoute(request, options.health ?? {});
    },
    async generate(request) {
      const routeKey = resolveRoute(request, options.health ?? {});
      const provider = options.providers[routeKey];

      if (!provider) {
        throw new AiProviderError({
          code: "route_unavailable",
          message: "AI provider route is unavailable.",
          routeKey,
        });
      }

      return provider.generate({
        ...request,
        routeKey,
      });
    },
  };
}

function resolveRoute(
  request: AiProviderRequest,
  health: Partial<HealthByRoute>,
): AiConcreteProviderRouteKey {
  if (isConcreteRouteKey(request.routeKey)) {
    return request.routeKey;
  }

  const candidates = routeCandidates(request);
  const healthyRoute = candidates.find((routeKey) => isUsable(routeKey, health));

  if (healthyRoute) {
    return healthyRoute;
  }

  return candidates[0] ?? "low_cost";
}

function isConcreteRouteKey(
  routeKey: AiProviderRequest["routeKey"],
): routeKey is AiConcreteProviderRouteKey {
  return routeKey === "local" || routeKey === "low_cost" || routeKey === "premium";
}

function routeCandidates(request: AiProviderRequest): AiConcreteProviderRouteKey[] {
  if (request.assignmentPolicy?.preferredRoute) {
    return uniqueRoutes([
      request.assignmentPolicy.preferredRoute,
      "premium",
      "low_cost",
      "local",
    ]);
  }

  if (
    request.assignmentPolicy?.highStakes ||
    request.retry?.lowConfidence ||
    (request.retry?.attempt ?? 0) > 0
  ) {
    return ["premium", "low_cost", "local"];
  }

  if (request.taskType === "objective_explanation") {
    return ["low_cost", "local", "premium"];
  }

  return ["low_cost", "premium", "local"];
}

function uniqueRoutes(
  routes: AiConcreteProviderRouteKey[],
): AiConcreteProviderRouteKey[] {
  return Array.from(new Set(routes));
}

function isUsable(
  routeKey: AiConcreteProviderRouteKey,
  health: Partial<HealthByRoute>,
): boolean {
  const state = health[routeKey];
  return state === undefined || state === "healthy" || state === "configured";
}
