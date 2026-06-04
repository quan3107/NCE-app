/**
 * File: src/modules/ai-feedback/provider.openai-compatible.ts
 * Purpose: Call OpenAI-compatible chat completion providers through one adapter.
 * Why: Supports hosted and local runtimes without provider SDK coupling.
 */
import { AiProviderError } from "./provider.errors.js";
import type {
  AiConcreteProviderRouteKey,
  AiProvider,
  AiProviderRequest,
  AiProviderResult,
  AiProviderRouteConfig,
  AiProviderTokenUsage,
} from "./provider.types.js";

type FetchLike = typeof fetch;

type ProviderOptions = AiProviderRouteConfig & {
  fetch?: FetchLike;
  now?: () => number;
};

type ChatContentPart = {
  type?: string;
  text?: string;
};

type ChatCompletionResponse = {
  model?: unknown;
  choices?: Array<{
    message?: {
      content?: unknown;
    };
  }>;
  usage?: {
    prompt_tokens?: unknown;
    completion_tokens?: unknown;
    total_tokens?: unknown;
  };
};

const defaultMaxResponseBytes = 256 * 1024;

export class OpenAICompatibleProvider implements AiProvider {
  readonly routeKey: AiConcreteProviderRouteKey;

  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly model: string;
  private readonly reasoningEffort: AiProviderRouteConfig["reasoningEffort"];
  private readonly supportsReasoningEffort: boolean;
  private readonly timeoutMs: number;
  private readonly maxOutputTokens: number;
  private readonly maxResponseBytes: number;
  private readonly fetchImpl: FetchLike;
  private readonly now: () => number;

  constructor(options: ProviderOptions) {
    this.routeKey = options.routeKey;
    this.baseUrl = options.baseUrl;
    this.apiKey = options.apiKey;
    this.model = options.model;
    this.reasoningEffort = options.reasoningEffort;
    this.supportsReasoningEffort = options.supportsReasoningEffort;
    this.timeoutMs = options.timeoutMs;
    this.maxOutputTokens = options.maxOutputTokens;
    this.maxResponseBytes = options.maxResponseBytes ?? defaultMaxResponseBytes;
    this.fetchImpl = options.fetch ?? fetch;
    this.now = options.now ?? Date.now;
  }

  async generate(request: AiProviderRequest): Promise<AiProviderResult> {
    this.validateConfig();

    const startedAt = this.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchImpl(this.chatCompletionsUrl(), {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify(this.body(request)),
        signal: controller.signal,
      });

      return await this.parseResponse(response, request, startedAt);
    } catch (error) {
      throw this.normalizeNetworkError(error);
    } finally {
      clearTimeout(timeout);
    }
  }

  private validateConfig(): void {
    if (!this.model.trim()) {
      throw new AiProviderError({
        code: "missing_model",
        message: "AI provider route is missing a model.",
        routeKey: this.routeKey,
      });
    }

    if (!this.supportsReasoningEffort && this.reasoningEffort !== "none") {
      throw new AiProviderError({
        code: "unsupported_reasoning_effort",
        message: "AI provider route does not support reasoning effort.",
        routeKey: this.routeKey,
      });
    }
  }

  private chatCompletionsUrl(): string {
    const url = new URL(this.baseUrl);
    const basePath = url.pathname.replace(/\/+$/, "");
    url.pathname = `${basePath}/chat/completions`;
    return url.toString();
  }

  private headers(): Record<string, string> {
    const headers: Record<string, string> = {
      accept: "application/json",
      "content-type": "application/json",
    };

    if (this.apiKey) {
      headers.authorization = `Bearer ${this.apiKey}`;
    }

    return headers;
  }

  private body(request: AiProviderRequest): Record<string, unknown> {
    const body: Record<string, unknown> = {
      model: this.model,
      messages: request.messages,
      max_tokens: request.maxOutputTokens ?? this.maxOutputTokens,
    };

    if (request.temperature !== undefined) {
      body.temperature = request.temperature;
    }

    if (this.supportsReasoningEffort && this.reasoningEffort !== "none") {
      body.reasoning_effort = this.reasoningEffort;
    }

    if (request.expectJson) {
      body.response_format = { type: "json_object" };
    }

    return body;
  }

  private async parseResponse(
    response: Response,
    request: AiProviderRequest,
    startedAt: number,
  ): Promise<AiProviderResult> {
    const responseText = await response.text();

    if (responseText.length > this.maxResponseBytes) {
      throw new AiProviderError({
        code: "response_too_large",
        message: "AI provider response exceeded the configured size limit.",
        routeKey: this.routeKey,
      });
    }

    let payload: ChatCompletionResponse;
    try {
      payload = JSON.parse(responseText) as ChatCompletionResponse;
    } catch {
      throw new AiProviderError({
        code: "malformed_json",
        message: "AI provider returned malformed JSON.",
        routeKey: this.routeKey,
      });
    }

    if (!response.ok) {
      throw new AiProviderError({
        code: "http_error",
        message: extractProviderErrorMessage(payload) ?? "AI provider request failed.",
        routeKey: this.routeKey,
        details: { status: response.status },
      });
    }

    const rawText = normalizeContent(payload.choices?.[0]?.message?.content).trim();
    if (!rawText) {
      throw new AiProviderError({
        code: "empty_content",
        message: "AI provider returned empty content.",
        routeKey: this.routeKey,
      });
    }

    return {
      rawText,
      parsedJson: parseJsonIfPossible(rawText),
      model: typeof payload.model === "string" ? payload.model : this.model,
      routeKey: this.routeKey,
      latencyMs: Math.max(0, this.now() - startedAt),
      tokenUsage: normalizeTokenUsage(payload.usage),
      providerRequestId:
        response.headers.get("x-request-id") ??
        response.headers.get("request-id") ??
        undefined,
      request,
    };
  }

  private normalizeNetworkError(error: unknown): AiProviderError {
    if (error instanceof AiProviderError) {
      return error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      return new AiProviderError({
        code: "timeout",
        message: "AI provider request timed out.",
        routeKey: this.routeKey,
      });
    }

    if (isConnectionRefused(error)) {
      return new AiProviderError({
        code: "connection_refused",
        message: "AI provider connection was refused.",
        routeKey: this.routeKey,
      });
    }

    return new AiProviderError({
      code: "http_error",
      message: "AI provider request failed.",
      routeKey: this.routeKey,
    });
  }
}

function normalizeContent(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content.map(normalizeContentPart).join("");
  }

  return "";
}

function normalizeContentPart(part: unknown): string {
  if (typeof part === "string") {
    return part;
  }

  if (!part || typeof part !== "object") {
    return "";
  }

  const contentPart = part as ChatContentPart;
  return typeof contentPart.text === "string" ? contentPart.text : "";
}

function parseJsonIfPossible(rawText: string): unknown {
  try {
    return JSON.parse(rawText);
  } catch {
    return undefined;
  }
}

function normalizeTokenUsage(
  usage: ChatCompletionResponse["usage"],
): AiProviderTokenUsage | undefined {
  if (!usage) {
    return undefined;
  }

  return {
    promptTokens: numberOrUndefined(usage.prompt_tokens),
    completionTokens: numberOrUndefined(usage.completion_tokens),
    totalTokens: numberOrUndefined(usage.total_tokens),
  };
}

function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function extractProviderErrorMessage(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") {
    return undefined;
  }

  const error = (payload as { error?: unknown }).error;
  if (!error || typeof error !== "object") {
    return undefined;
  }

  const message = (error as { message?: unknown }).message;
  return typeof message === "string" ? message : undefined;
}

function isConnectionRefused(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const code = (error as { code?: unknown }).code;
  return code === "ECONNREFUSED" || error.message.includes("ECONNREFUSED");
}

