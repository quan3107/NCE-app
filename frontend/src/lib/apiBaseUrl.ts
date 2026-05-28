/**
 * Location: src/lib/apiBaseUrl.ts
 * Purpose: Resolve the backend API base URL for browser and test runtimes.
 * Why: Keeps local loopback cookie hosts aligned during live auth refreshes.
 */

type ResolveApiBaseUrlOptions = {
  isDev: boolean;
  locationHostname?: string | null;
};

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

const normalizeHostname = (hostname: string) =>
  hostname.startsWith('[') && hostname.endsWith(']')
    ? hostname.slice(1, -1)
    : hostname;

const isLoopbackAlias = (hostname: string) =>
  LOOPBACK_HOSTS.has(hostname) || LOOPBACK_HOSTS.has(normalizeHostname(hostname));

const readConfiguredApiBaseUrl = () => {
  if (typeof import.meta !== 'undefined' && typeof import.meta.env?.VITE_API_BASE_URL === 'string') {
    return import.meta.env.VITE_API_BASE_URL;
  }

  if (
    typeof process !== 'undefined' &&
    typeof process.env?.VITE_API_BASE_URL === 'string'
  ) {
    return process.env.VITE_API_BASE_URL;
  }

  return '';
};

const readIsDev = () => {
  if (typeof import.meta !== 'undefined' && typeof import.meta.env?.DEV === 'boolean') {
    return import.meta.env.DEV;
  }

  if (typeof process !== 'undefined') {
    return process.env?.NODE_ENV !== 'production';
  }

  return false;
};

const readLocationHostname = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.location.hostname;
};

export function resolveApiBaseUrl(
  configuredApiBaseUrl: string,
  options: ResolveApiBaseUrlOptions,
) {
  if (!configuredApiBaseUrl || !options.isDev || !options.locationHostname) {
    return configuredApiBaseUrl;
  }

  try {
    const apiUrl = new URL(configuredApiBaseUrl);
    if (
      isLoopbackAlias(apiUrl.hostname) &&
      isLoopbackAlias(options.locationHostname) &&
      normalizeHostname(apiUrl.hostname) !== normalizeHostname(options.locationHostname)
    ) {
      apiUrl.hostname = options.locationHostname;
      return apiUrl.toString().replace(/\/$/, '');
    }
  } catch {
    return configuredApiBaseUrl;
  }

  return configuredApiBaseUrl;
}

export function getApiBaseUrl() {
  const configuredApiBaseUrl = readConfiguredApiBaseUrl();

  if (!configuredApiBaseUrl) {
    if (typeof console !== 'undefined' && typeof console.warn === 'function') {
      console.warn(
        '[config] Missing VITE_API_BASE_URL. Set it to the full API base (including /api/v1), e.g. http://localhost:4000/api/v1.',
      );
    }
    return configuredApiBaseUrl;
  }

  return resolveApiBaseUrl(configuredApiBaseUrl, {
    isDev: readIsDev(),
    locationHostname: readLocationHostname(),
  });
}

export const API_BASE_URL = getApiBaseUrl();
