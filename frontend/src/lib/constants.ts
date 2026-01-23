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
      : '';

if (!resolvedApiBaseUrl) {
  if (typeof console !== 'undefined' && typeof console.warn === 'function') {
    console.warn(
      '[config] Missing VITE_API_BASE_URL. Set it to the full API base (including /api/v1), e.g. http://localhost:4000/api/v1.',
    );
  }
}

export const API_BASE_URL = resolvedApiBaseUrl;
// Demo persona fallback disabled for now to validate live auth-only flows.
export const ENABLE_DEV_AUTH_FALLBACK = false;
export const STORAGE_KEYS = {
  currentUser: 'currentUser',
} as const;
