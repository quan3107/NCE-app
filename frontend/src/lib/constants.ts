/**
 * Location: src/lib/constants.ts
 * Purpose: Centralize shared configuration constants for the frontend.
 * Why: Avoids scattering magic strings across the refactored codebase.
 */

// Demo persona fallback disabled for now to validate live auth-only flows.
export const ENABLE_DEV_AUTH_FALLBACK = false;
export const STORAGE_KEYS = {
  currentUser: 'currentUser',
} as const;
