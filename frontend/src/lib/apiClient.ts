/**
 * Location: src/lib/apiClient.ts
 * Purpose: Wrap fetch calls with shared headers and error handling.
 * Why: Provides a single integration point for backend requests post-refactor.
 */

import { API_BASE_URL, STORAGE_KEYS } from './constants';

type Primitive = string | number | boolean;

export type ApiClientOptions<TBody = unknown> = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: TBody;
  params?: Record<string, Primitive | undefined>;
  headers?: HeadersInit;
  signal?: AbortSignal;
  withAuth?: boolean;
  parseJson?: boolean;
};

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const JSON_CONTENT_TYPE = 'application/json';

function buildUrl(endpoint: string, params?: ApiClientOptions['params']) {
  const url = new URL(endpoint, API_BASE_URL);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    });
  }

  return url;
}

function getAuthHeaders() {
  const storedUser = localStorage.getItem(STORAGE_KEYS.currentUser);

  if (!storedUser) {
    return {};
  }

  try {
    const { token } = JSON.parse(storedUser);
    if (token) {
      return { Authorization: `Bearer ${token}` };
    }
  } catch {
    // Swallow parse errors to avoid breaking the request pipeline.
  }

  return {};
}

export async function apiClient<TResponse = unknown, TBody = unknown>(
  endpoint: string,
  {
    method = 'GET',
    body,
    params,
    headers,
    signal,
    withAuth = true,
    parseJson = true,
  }: ApiClientOptions<TBody> = {},
): Promise<TResponse> {
  const url = buildUrl(endpoint, params);
  const authHeaders = withAuth ? getAuthHeaders() : {};

  const init: RequestInit = {
    method,
    signal,
    headers: {
      'Content-Type': JSON_CONTENT_TYPE,
      ...headers,
      ...authHeaders,
    },
  };

  if (body !== undefined && body !== null && method !== 'GET') {
    init.body = typeof body === 'string' ? body : JSON.stringify(body);
  }

  const response = await fetch(url, init);

  if (!response.ok) {
    const contentType = response.headers.get('content-type');
    const errorPayload =
      contentType && contentType.includes(JSON_CONTENT_TYPE)
        ? await response.json().catch(() => undefined)
        : await response.text().catch(() => undefined);

    const message =
      (typeof errorPayload === 'object' && errorPayload && 'message' in errorPayload
        ? String((errorPayload as { message: unknown }).message)
        : undefined) ?? response.statusText ?? 'Request failed';

    throw new ApiError(message, response.status, errorPayload);
  }

  if (!parseJson || response.status === 204) {
    return undefined as TResponse;
  }

  return (await response.json()) as TResponse;
}
