/**
 * Location: src/lib/constants.ts
 * Purpose: Centralize shared configuration constants for the frontend.
 * Why: Avoids scattering magic strings across the refactored codebase.
 */

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';
export const STORAGE_KEYS = {
  currentUser: 'currentUser',
} as const;
