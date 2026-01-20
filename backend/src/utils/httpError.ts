/**
 * File: src/utils/httpError.ts
 * Purpose: Provide helpers for throwing HTTP-aware errors from service layers.
 * Why: Keeps error handling consistent with middleware expectations without duplicating boilerplate.
 */
type HttpError = Error & {
  statusCode?: number;
  expose?: boolean;
  details?: unknown;
};

export function createHttpError(
  statusCode: number,
  message: string,
  details?: unknown,
): HttpError {
  const error = new Error(message) as HttpError;
  error.statusCode = statusCode;
  error.expose = statusCode < 500;
  error.details = details;
  return error;
}

export function createNotFoundError(
  resource: string,
  identifier: string,
): HttpError {
  return createHttpError(404, `${resource} not found.`, {
    identifier,
  });
}
