/**
 * File: src/modules/ai-feedback/ai-feedback.service.ts
 * Purpose: Resolve AI feedback provider readiness without exposing provider secrets.
 * Why: Lets admins inspect AI readiness while keeping app startup independent from provider state.
 */
import type { AiFeedbackConfig } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import {
  aiFeedbackHealthResponseSchema,
  type AiFeedbackHealthResponse,
} from "./ai-feedback.schema.js";
import { aiFeedbackConfig } from "./ai-feedback.config.js";

export {
  getAiObjectiveExplanationStatus,
  requestAiObjectiveExplanation,
} from "./ai-feedback.objective-explanations.js";
export {
  enqueueAiWritingFeedbackForSubmission,
  requestAiWritingFeedback,
} from "./ai-feedback.writing-feedback.js";

type HealthProbe = (
  url: URL,
  options: {
    headers: Record<string, string>;
    signal: AbortSignal;
  },
) => Promise<Response>;

type HealthOptions = {
  probe?: HealthProbe;
  now?: () => Date;
};

class ProviderHealthTimeoutError extends Error {
  constructor() {
    super("Provider health check timed out.");
    this.name = "ProviderHealthTimeoutError";
  }
}

const safeQueryParameterNames = new Set(["api-version", "version"]);

function buildBaseHealthResponse(
  config: AiFeedbackConfig,
  checkedAt: Date,
): AiFeedbackHealthResponse {
  return {
    status: "configured",
    enabled: config.enabled,
    checked_at: checkedAt.toISOString(),
    provider: {
      name: config.provider,
      base_url: redactSensitiveUrl(config.baseUrl),
      health_path: redactSensitivePath(config.healthPath),
    },
    limits: {
      timeout_ms: config.timeoutMs,
      max_input_chars: config.maxInputChars,
      max_output_tokens: config.maxOutputTokens,
      image_max_bytes: config.imageInput.maxBytes,
      image_supported_mime_types: config.imageInput.supportedMimeTypes,
    },
    routes: {
      low_cost: {
        model: config.routes.lowCost.model,
        reasoning_effort: config.routes.lowCost.reasoningEffort,
        supports_image_input: config.routes.lowCost.supportsImageInput,
      },
      premium: {
        model: config.routes.premium.model,
        reasoning_effort: config.routes.premium.reasoningEffort,
        supports_image_input: config.routes.premium.supportsImageInput,
      },
    },
  };
}

function getMisconfiguration(config: AiFeedbackConfig): string | null {
  if (!config.enabled) {
    return null;
  }

  if (!config.apiKey) {
    return "AI_API_KEY is required when AI feedback is enabled.";
  }

  try {
    const parsedUrl = new URL(config.baseUrl);
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return "AI_BASE_URL must use http or https.";
    }
  } catch {
    return "AI_BASE_URL must be a valid URL.";
  }

  return null;
}

function redactSensitiveUrl(value: string): string {
  try {
    const url = new URL(value);

    if (url.username) {
      url.username = "REDACTED";
    }

    if (url.password) {
      url.password = "REDACTED";
    }

    redactQueryValues(url);

    return url.toString();
  } catch {
    return "invalid-url";
  }
}

function redactSensitivePath(value: string): string {
  if (!value.trim()) {
    return value;
  }

  try {
    const url = new URL(value, "https://redaction.local");

    redactQueryValues(url);

    return `${url.pathname}${url.search}`;
  } catch {
    return "invalid-path";
  }
}

function redactQueryValues(url: URL): void {
  for (const key of Array.from(url.searchParams.keys())) {
    if (!safeQueryParameterNames.has(key.toLowerCase())) {
      url.searchParams.set(key, "REDACTED");
    }
  }
}

function joinUrlPaths(basePath: string, healthPath: string): string {
  const left = basePath.replace(/\/+$/, "");
  const right = healthPath.replace(/^\/+/, "");

  if (!left && !right) {
    return "/";
  }

  if (!left) {
    return `/${right}`;
  }

  if (!right) {
    return left;
  }

  return `${left}/${right}`;
}

function buildProviderHealthUrl(config: AiFeedbackConfig): URL {
  const baseUrl = new URL(config.baseUrl);
  const [rawHealthPath, rawHealthQuery = ""] = config.healthPath.split("?", 2);

  baseUrl.pathname = joinUrlPaths(baseUrl.pathname, rawHealthPath);

  if (rawHealthQuery) {
    baseUrl.search = rawHealthQuery;
  }

  return baseUrl;
}

function buildHealthHeaders(config: AiFeedbackConfig): Record<string, string> {
  return {
    Authorization: `Bearer ${config.apiKey ?? ""}`,
    Accept: "application/json",
  };
}

async function defaultHealthProbe(
  url: URL,
  options: {
    headers: Record<string, string>;
    signal: AbortSignal;
  },
): Promise<Response> {
  return fetch(url, {
    method: "GET",
    headers: options.headers,
    signal: options.signal,
    redirect: "manual",
  });
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  controller: AbortController,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      controller.abort();
      reject(new ProviderHealthTimeoutError());
    }, timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

function isTimeoutError(error: unknown): boolean {
  return (
    error instanceof ProviderHealthTimeoutError ||
    (error instanceof Error && error.name === "AbortError")
  );
}

function summarizeProbeError(error: unknown): { name: string } {
  if (error instanceof Error) {
    return {
      name: error.name,
    };
  }

  return {
    name: typeof error,
  };
}

export async function getAiFeedbackHealth(
  config: AiFeedbackConfig = aiFeedbackConfig,
  options: HealthOptions = {},
): Promise<AiFeedbackHealthResponse> {
  const checkedAt = options.now?.() ?? new Date();
  const baseResponse = buildBaseHealthResponse(config, checkedAt);

  if (!config.enabled) {
    return aiFeedbackHealthResponseSchema.parse({
      ...baseResponse,
      status: "disabled",
    });
  }

  const misconfiguration = getMisconfiguration(config);
  if (misconfiguration) {
    return aiFeedbackHealthResponseSchema.parse({
      ...baseResponse,
      status: "misconfigured",
      problem: misconfiguration,
    });
  }

  if (!config.healthPath.trim()) {
    return aiFeedbackHealthResponseSchema.parse(baseResponse);
  }

  const controller = new AbortController();
  const probe = options.probe ?? defaultHealthProbe;
  const healthUrl = buildProviderHealthUrl(config);

  try {
    const response = await withTimeout(
      probe(healthUrl, {
        headers: buildHealthHeaders(config),
        signal: controller.signal,
      }),
      config.timeoutMs,
      controller,
    );

    return aiFeedbackHealthResponseSchema.parse({
      ...baseResponse,
      status: response.ok ? "healthy" : "unhealthy",
      provider: {
        ...baseResponse.provider,
        http_status: response.status,
      },
      problem: response.ok ? undefined : "Provider health check returned a non-2xx status.",
    });
  } catch (error) {
    const timedOut = isTimeoutError(error);

    if (!timedOut) {
      logger.warn(
        {
          event: "ai_feedback_provider_health_check_failed",
          provider: config.provider,
          baseUrl: redactSensitiveUrl(config.baseUrl),
          healthPath: redactSensitivePath(config.healthPath),
          error: summarizeProbeError(error),
        },
        "AI feedback provider health check failed",
      );
    }

    return aiFeedbackHealthResponseSchema.parse({
      ...baseResponse,
      status: timedOut ? "timeout" : "unhealthy",
      problem: timedOut
        ? "Provider health check timed out."
        : "Provider health check failed.",
    });
  }
}
