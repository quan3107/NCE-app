/**
 * Location: src/lib/apiClient.ts
 * Purpose: Wrap fetch calls with shared headers, credential handling, and refresh-aware retries.
 * Why: Provides a single integration point for backend requests during the auth transition.
 */

import { authBridge } from './authBridge';
import { API_BASE_URL } from './apiBaseUrl';
import { STORAGE_KEYS } from './constants';

type Primitive = string | number | boolean;

export type ApiClientOptions<TBody = unknown> = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: TBody;
  params?: Record<string, Primitive | undefined>;
  headers?: HeadersInit;
  signal?: AbortSignal;
  withAuth?: boolean;
  parseJson?: boolean;
  responseType?: 'blob' | 'json' | 'text';
  credentials?: RequestCredentials;
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

type StoredAuthPayload = {
  token?: string | null;
  liveUser?: {
    id?: string;
    role?: string;
  } | null;
};

const ABSOLUTE_URL_PATTERN = /^[a-z][a-z\d+\-.]*:\/\//i;
const API_VERSION_PREFIX = '/api/v1';
const SHOULD_LOG_API_ERRORS = import.meta.env?.DEV ?? false;

function buildUrl(endpoint: string, params?: ApiClientOptions['params']) {
  const trimmedEndpoint = endpoint.trim();
  const isAbsolute = ABSOLUTE_URL_PATTERN.test(trimmedEndpoint);

  let targetPath = trimmedEndpoint;

  if (!isAbsolute) {
    const withLeadingSlash = trimmedEndpoint.startsWith('/')
      ? trimmedEndpoint
      : `/${trimmedEndpoint}`;

    targetPath = withLeadingSlash.startsWith('/api/')
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

function readStoredBearerToken(): string | null {
  const storage = (globalThis as { localStorage?: Storage }).localStorage;
  if (!storage) {
    return null;
  }

  const stored = storage.getItem(STORAGE_KEYS.currentUser);
  if (!stored) {
    return null;
  }

  try {
    const parsed = JSON.parse(stored) as StoredAuthPayload;
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Invalid stored auth payload');
    }

    if (!parsed.liveUser) {
      return null;
    }

    return typeof parsed.token === 'string' && parsed.token.length > 0 ? parsed.token : null;
  } catch {
    return null;
  }
}

function getAuthHeaders(): Record<string, string> {
  const token = authBridge.getAccessToken();
  if (typeof token === 'string' && token.length > 0) {
    return {
      Authorization: `Bearer ${token}`,
    };
  }

  const storedToken = readStoredBearerToken();
  if (storedToken) {
    return {
      Authorization: `Bearer ${storedToken}`,
    };
  }

  return {};
}

async function parseErrorPayload(response: Response) {
  const contentType = response.headers.get('content-type');

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
): Promise<TResponse> {
  const {
    method = 'GET',
    body,
    params,
    headers,
    signal,
    withAuth = true,
    parseJson = true,
    responseType = parseJson ? 'json' : undefined,
    credentials,
  } = options;

  const url = buildUrl(endpoint, params);
  const authHeaders = withAuth ? getAuthHeaders() : {};
  const hasBearerAuth = withAuth && typeof authHeaders.Authorization === 'string';

  const init: RequestInit = {
    method,
    signal,
    headers: {
      'Content-Type': JSON_CONTENT_TYPE,
      ...headers,
      ...authHeaders,
    },
  };

  if (credentials) {
    init.credentials = credentials;
  }

  if (body !== undefined && body !== null && method !== 'GET') {
    init.body = typeof body === 'string' ? body : JSON.stringify(body);
  }

  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (error) {
    logApiError(method, url, 0, error);
    throw new ApiError(
      'Server is unavailable. Please check that the backend API is running.',
      0,
      error,
    );
  }

  if (response.status === 401 && withAuth && hasBearerAuth && !hasRetried) {
    const refreshed = await authBridge.refreshAccessToken();
    if (refreshed) {
      return apiClientInternal(endpoint, options, true);
    }
    authBridge.clearSession();
  }

  if (!response.ok) {
    const errorPayload = await parseErrorPayload(response);
    logApiError(method, url, response.status, errorPayload);
    const message =
      (typeof errorPayload === 'object' &&
      errorPayload !== null &&
      'message' in errorPayload
        ? String((errorPayload as { message: unknown }).message)
        : undefined) ?? response.statusText ?? 'Request failed';

    throw new ApiError(message, response.status, errorPayload);
  }

  if (response.status === 204 || responseType === undefined) {
    return undefined as TResponse;
  }

  if (responseType === 'blob') {
    return (await response.blob()) as TResponse;
  }
  if (responseType === 'text') {
    return (await response.text()) as TResponse;
  }

  return (await response.json()) as TResponse;
}

export async function apiClient<TResponse = unknown, TBody = unknown>(
  endpoint: string,
  options: ApiClientOptions<TBody> = {},
): Promise<TResponse> {
  return apiClientInternal<TResponse, TBody>(endpoint, options, false);
}
