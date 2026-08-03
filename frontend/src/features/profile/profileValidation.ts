/**
 * Location: features/profile/profileValidation.ts
 * Purpose: Mirror profile-name rules and extract backend field feedback.
 * Why: The editor should reject known-invalid text and preserve actionable 400 errors.
 */
import { ApiError } from "@lib/apiClient";

const NAME_LENGTH_ERROR = "Name must be between 2 and 100 characters.";
const POSTGRES_TEXT_ERROR =
  "Full name must contain only PostgreSQL-safe Unicode text";
const DISPLAY_CONTROL_ERROR =
  "Full name must not contain non-printing or bidirectional controls";
const DISPLAY_CONTROL_PATTERN = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u;

type ProfileNameValidation = {
  normalizedName: string;
  error: string | null;
};

function isPostgresSafeText(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit === 0) return false;
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const nextCodeUnit = value.charCodeAt(index + 1);
      if (nextCodeUnit < 0xdc00 || nextCodeUnit > 0xdfff) return false;
      index += 1;
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      return false;
    }
  }
  return true;
}

export function validateProfileDisplayName(
  value: string,
): ProfileNameValidation {
  const normalizedName = value.trim();
  const codePointLength = Array.from(normalizedName).length;
  if (codePointLength < 2 || codePointLength > 100) {
    return { normalizedName, error: NAME_LENGTH_ERROR };
  }
  if (!isPostgresSafeText(normalizedName)) {
    return { normalizedName, error: POSTGRES_TEXT_ERROR };
  }
  if (DISPLAY_CONTROL_PATTERN.test(normalizedName)) {
    return { normalizedName, error: DISPLAY_CONTROL_ERROR };
  }
  return { normalizedName, error: null };
}

function objectOrNull(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

export function profileNameFieldError(error: unknown): string | null {
  if (!(error instanceof ApiError) || error.status !== 400) {
    return null;
  }
  const payload = objectOrNull(error.details);
  const details = objectOrNull(payload?.details) ?? payload;
  const fieldErrors = objectOrNull(details?.fieldErrors);
  const messages = fieldErrors?.fullName;
  if (!Array.isArray(messages)) {
    return null;
  }
  return (
    messages.find(
      (message): message is string =>
        typeof message === "string" && message.trim().length > 0,
    ) ?? null
  );
}
