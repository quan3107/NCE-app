/**
 * Location: src/lib/constants.ts
 * Purpose: Centralize shared configuration constants for the frontend.
 * Why: Avoids scattering magic strings across the refactored codebase.
 */

const resolvedApiBaseUrl =
  typeof import.meta !== 'undefined' && typeof import.meta.env?.VITE_API_BASE_URL === 'string'
    ? import.meta.env.VITE_API_BASE_URL
    : typeof process !== 'undefined' &&
        typeof process.env?.VITE_API_BASE_URL === 'string'
      ? process.env.VITE_API_BASE_URL
      : 'http://localhost:4000';

export const API_BASE_URL = resolvedApiBaseUrl;
// Allow explicit env override; default to Vite DEV for the demo fallback.
const resolvedDevAuthFallback =
  typeof import.meta !== 'undefined' && typeof import.meta.env?.VITE_ENABLE_DEV_AUTH_FALLBACK === 'string'
    ? import.meta.env.VITE_ENABLE_DEV_AUTH_FALLBACK === 'true'
    : typeof import.meta !== 'undefined' && typeof import.meta.env?.DEV === 'boolean'
      ? import.meta.env.DEV
      : false;

export const ENABLE_DEV_AUTH_FALLBACK = resolvedDevAuthFallback;
export const STORAGE_KEYS = {
  currentUser: 'currentUser',
} as const;
