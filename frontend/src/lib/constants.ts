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
export const STORAGE_KEYS = {
  currentUser: 'currentUser',
} as const;
