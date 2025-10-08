/**
 * File: src/utils/dateUtils.ts
 * Purpose: Provide reusable helpers for handling UTC date formatting and comparisons.
 * Why: Centralizes recurring date operations needed by assignment and notification logic.
 */
/**
 * Normalize a date-like input into an ISO-8601 string in UTC.
 */
export function toUtcIsoString(input: Date | string | number): string {
  return new Date(input).toISOString();
}

/**
 * Calculate the relative difference in milliseconds between now and a target timestamp.
 */
export function millisecondsUntil(target: Date | string | number): number {
  return new Date(target).getTime() - Date.now();
}
