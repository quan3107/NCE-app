/**
 * File: src/modules/ai-feedback/provider.errors.ts
 * Purpose: Normalize AI provider failures into stable app-level errors.
 * Why: Lets downstream services retry or report failures without vendor-specific parsing.
 */
import type { AiConcreteProviderRouteKey } from "./provider.types.js";

export type AiProviderErrorCode =
  | "connection_refused"
  | "timeout"
  | "http_error"
  | "malformed_json"
  | "empty_content"
  | "missing_model"
  | "unsupported_reasoning_effort"
  | "response_too_large"
  | "route_unavailable";

type AiProviderErrorOptions = {
  code: AiProviderErrorCode;
  message: string;
  routeKey?: AiConcreteProviderRouteKey;
  retryable?: boolean;
  statusCode?: number;
  details?: unknown;
};

const defaultStatusByCode = {
  connection_refused: 503,
  timeout: 504,
  http_error: 502,
  malformed_json: 502,
  empty_content: 502,
  missing_model: 500,
  unsupported_reasoning_effort: 500,
  response_too_large: 502,
  route_unavailable: 503,
} satisfies Record<AiProviderErrorCode, number>;

const defaultRetryableByCode = {
  connection_refused: true,
  timeout: true,
  http_error: true,
  malformed_json: false,
  empty_content: true,
  missing_model: false,
  unsupported_reasoning_effort: false,
  response_too_large: false,
  route_unavailable: true,
} satisfies Record<AiProviderErrorCode, boolean>;

export class AiProviderError extends Error {
  readonly code: AiProviderErrorCode;
  readonly routeKey?: AiConcreteProviderRouteKey;
  readonly retryable: boolean;
  readonly statusCode: number;
  readonly details?: unknown;

  constructor(options: AiProviderErrorOptions) {
    super(options.message);
    this.name = "AiProviderError";
    this.code = options.code;
    this.routeKey = options.routeKey;
    this.retryable = options.retryable ?? defaultRetryableByCode[options.code];
    this.statusCode = options.statusCode ?? defaultStatusByCode[options.code];
    this.details = options.details;
  }
}
