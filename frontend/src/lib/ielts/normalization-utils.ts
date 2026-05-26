/**
 * Location: src/lib/ielts/normalization-utils.ts
 * Purpose: Provide primitive coercion helpers for IELTS config normalization.
 * Why: Keeps compatibility parsing small and consistent across focused normalizers.
 */

export const toNumber = (value: unknown, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

export const toString = (value: unknown, fallback = '') =>
  typeof value === 'string' ? value : fallback;

export const toBoolean = (value: unknown, fallback: boolean) =>
  typeof value === 'boolean' ? value : fallback;
