/**
 * Location: src/lib/apiClient.ts
 * Purpose: Wrap fetch calls with shared headers, credential handling, and refresh-aware retries.
 * Why: Provides a single integration point for backend requests during the auth transition.
 */

import { authBridge } from './authBridge';
import { API_BASE_URL, STORAGE_KEYS } from './constants';
import {
  DEFAULT_PERSONA,
  PERSONA_HEADERS,
  PersonaKey,
  roleToPersonaKey,
} from './devPersonas';

type Primitive = string | number | boolean;
type AuthMode = 'live' | 'persona';

export type ApiClientOptions<TBody = unknown> = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: TBody;
  params?: Record<string, Primitive | undefined>;
  headers?: HeadersInit;
  signal?: AbortSignal;
  withAuth?: boolean;
  parseJson?: boolean;
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

type StoredPersona = {
  basePersona: PersonaKey;
  actingPersona: PersonaKey | null;
};

type StoredAuthPayload = {
  mode?: AuthMode;
  token?: string | null;
  persona?: {
    basePersona?: unknown;
    actingPersona?: unknown;
  };
  liveUser?: {
    id?: string;
    role?: string;
  } | null;
  basePersona?: unknown;
  actingPersona?: unknown;
  effective?: {
    id?: string;
    role?: string;
  };
  id?: string;
  role?: string;
};

type StoredAuthContext = {
  mode: AuthMode;
  token: string | null;
  persona: StoredPersona;
};

const FALLBACK_AUTH = PERSONA_HEADERS.admin;

const ABSOLUTE_URL_PATTERN = /^[a-z][a-z\d+\-.]*:\/\//i;
const API_VERSION_PREFIX = '/api/v1';

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

const resolvePersonaKey = (value: unknown): PersonaKey | null =>
  typeof value === 'string' && value in PERSONA_HEADERS
    ? (value as PersonaKey)
    : null;

function readStoredAuth(): StoredAuthContext | null {
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

    const mode: AuthMode = parsed.mode === 'live' ? 'live' : 'persona';
    const token =
      typeof parsed.token === 'string' && parsed.token.length > 0 ? parsed.token : null;

    const personaCandidate = parsed.persona ?? {};
    const basePersona =
      resolvePersonaKey((personaCandidate as Record<string, unknown>).basePersona) ??
      resolvePersonaKey(parsed.basePersona) ??
      (typeof parsed.role === 'string'
        ? resolvePersonaKey(
            roleToPersonaKey[parsed.role as keyof typeof roleToPersonaKey],
          )
        : null) ??
      DEFAULT_PERSONA;
    const actingPersona =
      resolvePersonaKey((personaCandidate as Record<string, unknown>).actingPersona) ??
      resolvePersonaKey(parsed.actingPersona) ??
      null;

    return {
      mode,
      token,
      persona: {
        basePersona,
        actingPersona,
      },
    };
  } catch {
    return null;
  }
}

const personaHeadersFromStored = (context: StoredAuthContext | null) => {
  if (!context || context.mode !== 'persona' || !context.token) {
    return null;
  }

  const personaKey =
    context.persona.actingPersona !== null
      ? context.persona.actingPersona
      : context.persona.basePersona;

  const persona = PERSONA_HEADERS[personaKey] ?? FALLBACK_AUTH;

  return {
    'x-user-id': persona.id,
    'x-user-role': persona.role,
  };
};

function getAuthHeaders(): Record<string, string> {
  const token = authBridge.getAccessToken();
  if (typeof token === 'string' && token.length > 0) {
    return {
      Authorization: `Bearer ${token}`,
    };
  }

  const storedContext = readStoredAuth();

  if (storedContext?.mode === 'live' && storedContext.token) {
    return {
      Authorization: `Bearer ${storedContext.token}`,
    };
  }

  const personaHeaders = personaHeadersFromStored(storedContext);
  if (personaHeaders) {
    return personaHeaders;
  }

  return {
    'x-user-id': FALLBACK_AUTH.id,
    'x-user-role': FALLBACK_AUTH.role,
  };
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

  const response = await fetch(url, init);

  if (response.status === 401 && withAuth && hasBearerAuth && !hasRetried) {
    const refreshed = await authBridge.refreshAccessToken();
    if (refreshed) {
      return apiClientInternal(endpoint, options, true);
    }
    authBridge.clearSession();
  }

  if (!response.ok) {
    const errorPayload = await parseErrorPayload(response);
    const message =
      (typeof errorPayload === 'object' &&
      errorPayload !== null &&
      'message' in errorPayload
        ? String((errorPayload as { message: unknown }).message)
        : undefined) ?? response.statusText ?? 'Request failed';

    throw new ApiError(message, response.status, errorPayload);
  }

  if (!parseJson || response.status === 204) {
    return undefined as TResponse;
  }

  return (await response.json()) as TResponse;
}

export async function apiClient<TResponse = unknown, TBody = unknown>(
  endpoint: string,
  options: ApiClientOptions<TBody> = {},
): Promise<TResponse> {
  return apiClientInternal<TResponse, TBody>(endpoint, options, false);
}
