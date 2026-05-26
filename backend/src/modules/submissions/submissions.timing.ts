/**
 * File: src/modules/submissions/submissions.timing.ts
 * Purpose: Validate timing and attempt rules for student submissions.
 * Why: Keeps submission persistence focused while preserving assignment guardrails.
 */
import { createHttpError } from "../../utils/httpError.js";

export type SubmissionStatus = "draft" | "submitted" | "late";

function parseOptionalDate(
  value: string | undefined,
  fieldName: string,
): Date | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw createHttpError(400, `${fieldName} must be an ISO date string.`);
  }
  return parsed;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

export function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function parseSubmittedAt(value: string | undefined): Date | undefined {
  return parseOptionalDate(value, "submittedAt");
}

export function readMaxAttempts(
  assignmentConfig: unknown,
  isIeltsAssignment: boolean,
): number | undefined {
  if (!isIeltsAssignment) {
    return undefined;
  }

  const configRecord = asRecord(assignmentConfig);
  const attemptsConfig = configRecord ? asRecord(configRecord.attempts) : undefined;
  return readNumber(attemptsConfig?.maxAttempts);
}

export function applyIeltsTimingRules(input: {
  assignmentConfig: unknown;
  isIeltsAssignment: boolean;
  status: SubmissionStatus;
  submittedAt: Date | undefined;
  validatedPayload: unknown;
}): { status: SubmissionStatus; submittedAt: Date | undefined } {
  if (!input.isIeltsAssignment) {
    return { status: input.status, submittedAt: input.submittedAt };
  }

  const assignmentConfig = asRecord(input.assignmentConfig);
  const timingConfig = assignmentConfig ? asRecord(assignmentConfig.timing) : undefined;
  const enforceTiming = timingConfig?.enforce === true;
  const timingEnabled = timingConfig?.enabled !== false;

  if (!enforceTiming || !timingEnabled) {
    return { status: input.status, submittedAt: input.submittedAt };
  }

  const payloadRecord = asRecord(input.validatedPayload);
  const startedAtValue = readString(payloadRecord?.startedAt);
  if (!startedAtValue) {
    throw createHttpError(
      400,
      "payload.startedAt is required for timed submissions.",
    );
  }

  const startedAt = parseOptionalDate(startedAtValue, "payload.startedAt");
  if (!startedAt) {
    throw createHttpError(
      400,
      "payload.startedAt is required for timed submissions.",
    );
  }

  const windowStart = parseOptionalDate(
    readString(timingConfig?.startAt),
    "assignmentConfig.timing.startAt",
  );
  const windowEnd = parseOptionalDate(
    readString(timingConfig?.endAt),
    "assignmentConfig.timing.endAt",
  );

  if (windowStart && startedAt < windowStart) {
    throw createHttpError(
      400,
      "Submission start time is before the allowed window.",
    );
  }

  const rejectLateStart = timingConfig?.rejectLateStart !== false;
  if (windowEnd && startedAt > windowEnd && rejectLateStart) {
    throw createHttpError(
      400,
      "Submission start time is after the allowed window.",
    );
  }

  const timingDurationMinutes = readNumber(timingConfig?.durationMinutes);
  if (!timingDurationMinutes) {
    return { status: input.status, submittedAt: input.submittedAt };
  }

  const effectiveSubmittedAt = input.submittedAt ?? new Date();
  const elapsedMs = effectiveSubmittedAt.getTime() - startedAt.getTime();
  const limitMs = timingDurationMinutes * 60 * 1000;
  if (elapsedMs <= limitMs) {
    return { status: input.status, submittedAt: input.submittedAt };
  }

  if (timingConfig?.autoSubmit === true) {
    return { status: "submitted", submittedAt: effectiveSubmittedAt };
  }

  throw createHttpError(400, "Submission exceeded the time limit.");
}
