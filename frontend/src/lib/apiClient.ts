/**
 * Location: src/lib/apiClient.ts
 * Purpose: Wrap fetch calls with shared headers and error handling.
 * Why: Provides a single integration point for backend requests post-refactor.
 */

import { API_BASE_URL, STORAGE_KEYS } from './constants';
import { PERSONA_HEADERS } from './devPersonas';

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

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type StoredAuthPayload = {
  id?: string;
  role?: string;
  token?: string;
  effective?: {
    id?: string;
    role?: string;
  };
  basePersona?: string;
  actingPersona?: string | null;
};

const FALLBACK_AUTH = PERSONA_HEADERS.admin;

const isUuid = (value: unknown): value is string =>
  typeof value === 'string' && UUID_PATTERN.test(value);

const isSupportedRole = (value: unknown): value is 'admin' | 'teacher' | 'student' =>
  value === 'admin' || value === 'teacher' || value === 'student';

function getAuthHeaders() {
  const storedUser = localStorage.getItem(STORAGE_KEYS.currentUser);

  if (!storedUser) {
    return {
      'x-user-id': FALLBACK_AUTH.id,
      'x-user-role': FALLBACK_AUTH.role,
    };
  }

  try {
    const parsed = JSON.parse(storedUser) as StoredAuthPayload;

    const effective = parsed.effective ?? {};
    const rawId =
      typeof effective.id === 'string' && effective.id.length > 0
        ? effective.id
        : parsed.id;
    const rawRole =
      typeof effective.role === 'string' && effective.role.length > 0
        ? effective.role
        : parsed.role;

    const userId = isUuid(rawId) ? rawId : FALLBACK_AUTH.id;
    const role = isSupportedRole(rawRole) ? rawRole : FALLBACK_AUTH.role;

    const headers: Record<string, string> = {
      'x-user-id': userId,
      'x-user-role': role,
    };

    if (typeof parsed.token === 'string' && parsed.token.length > 0) {
      headers.Authorization = `Bearer ${parsed.token}`;
    }

    return headers;
  } catch {
    return {
      'x-user-id': FALLBACK_AUTH.id,
      'x-user-role': FALLBACK_AUTH.role,
    };
  }
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
