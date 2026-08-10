/**
 * Location: src/lib/apiClient.ts
 * Purpose: Wrap fetch calls with shared headers, credential handling, and refresh-aware retries.
 * Why: Provides a single integration point for backend requests during the auth transition.
 */

import { authBridge } from "./authBridge";
import { API_BASE_URL } from "./apiBaseUrl";
type Primitive = string | number | boolean;
export type RequestAuthMode = "none" | "optional" | "required";
export type ApiClientOptions<TBody = unknown> = {
  auth: RequestAuthMode;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: TBody;
  params?: Record<string, Primitive | undefined>;
  headers?: HeadersInit;
  signal?: AbortSignal;
  parseJson?: boolean;
  responseType?: "blob" | "json" | "text";
  credentials?: RequestCredentials;
};
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
const JSON_CONTENT_TYPE = "application/json";
type RequestSession = ReturnType<typeof authBridge.getSessionVersion>;
const ABSOLUTE_URL_PATTERN = /^[a-z][a-z\d+\-.]*:\/\//i;
const API_VERSION_PREFIX = "/api/v1";
const SHOULD_LOG_API_ERRORS = import.meta.env?.DEV ?? false;

function buildUrl(endpoint: string, params?: ApiClientOptions["params"]) {
  const trimmedEndpoint = endpoint.trim();
  const isAbsolute = ABSOLUTE_URL_PATTERN.test(trimmedEndpoint);

  let targetPath = trimmedEndpoint;

  if (!isAbsolute) {
    const withLeadingSlash = trimmedEndpoint.startsWith("/")
      ? trimmedEndpoint
      : `/${trimmedEndpoint}`;

    targetPath = withLeadingSlash.startsWith("/api/")
      ? withLeadingSlash
      : `${API_VERSION_PREFIX}${withLeadingSlash}`;
  }

  const url = isAbsolute
    ? new URL(targetPath)
    : new URL(targetPath, API_BASE_URL);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    });
  }

  return url;
}

function getAuthHeaders(): Record<string, string> {
  const token = authBridge.getAccessToken();
  if (typeof token === "string" && token.length > 0) {
    return {
      Authorization: `Bearer ${token}`,
    };
  }

  return {};
}

function sessionChangedError(): ApiError {
  return new ApiError(
    "Authentication session changed while the request was in flight.",
    0,
  );
}

function isSameSession(left: RequestSession, right: RequestSession): boolean {
  return (
    left.generation === right.generation &&
    left.sessionEpoch === right.sessionEpoch &&
    left.userId === right.userId
  );
}

function assertRequestSession(
  initiatingSession: RequestSession,
  hasBearerAuth: boolean,
): void {
  if (
    hasBearerAuth &&
    !isSameSession(initiatingSession, authBridge.getSessionVersion())
  ) {
    throw sessionChangedError();
  }
}

async function parseErrorPayload(response: Response) {
  const contentType = response.headers.get("content-type");

  if (contentType && contentType.includes(JSON_CONTENT_TYPE)) {
    try {
      return await response.json();
    } catch {
      return undefined;
    }
  }

  try {
    return await response.text();
  } catch {
    return undefined;
  }
}

function logApiError(
  method: string,
  url: URL,
  status: number,
  payload: unknown,
) {
  if (!SHOULD_LOG_API_ERRORS) {
    return;
  }

  const message = `[apiClient] ${method} ${url.toString()} -> ${status}`;
  console.warn(message, payload);
}

async function apiClientInternal<TResponse, TBody>(
  endpoint: string,
  options: ApiClientOptions<TBody>,
  hasRetried: boolean,
  initiatingSession: RequestSession,
  retryAccessToken?: string,
): Promise<TResponse> {
  const {
    method = "GET",
    body,
    params,
    headers,
    signal,
    auth = "required",
    parseJson = true,
    responseType = parseJson ? "json" : undefined,
    credentials,
  } = options;

  const url = buildUrl(endpoint, params);
  const authHeaders = auth !== "none"
    ? retryAccessToken
      ? { Authorization: `Bearer ${retryAccessToken}` }
      : getAuthHeaders()
    : {};
  const hasBearerAuth =
    auth !== "none" && typeof authHeaders.Authorization === "string";
  if (auth === "required" && !hasBearerAuth) {
    throw new ApiError("Authentication is required.", 401);
  }
  assertRequestSession(initiatingSession, hasBearerAuth);

  const init: RequestInit = {
    method,
    signal: hasBearerAuth ? authBridge.getRequestSignal(signal) : signal,
    headers: {
      "Content-Type": JSON_CONTENT_TYPE,
      ...headers,
      ...authHeaders,
    },
  };

  if (credentials) {
    init.credentials = credentials;
  }

  if (body !== undefined && body !== null && method !== "GET") {
    init.body = typeof body === "string" ? body : JSON.stringify(body);
  }

  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (error) {
    assertRequestSession(initiatingSession, hasBearerAuth);
    logApiError(method, url, 0, error);
    throw new ApiError(
      "Server is unavailable. Please check that the backend API is running.",
      0,
      error,
    );
  }
  assertRequestSession(initiatingSession, hasBearerAuth);

  if (response.status === 401 && auth !== "none" && hasBearerAuth && !hasRetried) {
    if (isSameSession(initiatingSession, authBridge.getSessionVersion())) {
      const refreshed = await authBridge.refreshAccessToken();
      if (
        refreshed.status === "refreshed" &&
        isSameSession(initiatingSession, authBridge.getSessionVersion())
      ) {
        return apiClientInternal(
          endpoint,
          options,
          true,
          initiatingSession,
          refreshed.accessToken,
        );
      }
    }
  }
  assertRequestSession(initiatingSession, hasBearerAuth);

  if (!response.ok) {
    const errorPayload = await parseErrorPayload(response);
    assertRequestSession(initiatingSession, hasBearerAuth);
    logApiError(method, url, response.status, errorPayload);
    const message =
      (typeof errorPayload === "object" &&
      errorPayload !== null &&
      "message" in errorPayload
        ? String((errorPayload as { message: unknown }).message)
        : undefined) ??
      response.statusText ??
      "Request failed";

    throw new ApiError(message, response.status, errorPayload);
  }

  if (response.status === 204 || responseType === undefined) {
    return undefined as TResponse;
  }

  if (responseType === "blob") {
    const payload = await response.blob();
    assertRequestSession(initiatingSession, hasBearerAuth);
    return payload as TResponse;
  }
  if (responseType === "text") {
    const payload = await response.text();
    assertRequestSession(initiatingSession, hasBearerAuth);
    return payload as TResponse;
  }

  const payload = await response.json();
  assertRequestSession(initiatingSession, hasBearerAuth);
  return payload as TResponse;
}

export async function apiClient<TResponse = unknown, TBody = unknown>(
  endpoint: string,
  options: ApiClientOptions<TBody>,
): Promise<TResponse> {
  const auth = options.auth;
  if (auth !== "none") await authBridge.waitUntilReady();
  return apiClientInternal<TResponse, TBody>(
    endpoint,
    { ...options, auth },
    false,
    authBridge.getSessionVersion(),
  );
}
