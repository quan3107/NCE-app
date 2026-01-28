/**
 * File: src/middleware/errorHandler.ts
 * Purpose: Central Express error handler that emits structured responses and logs details.
 * Why: Keeps error reporting consistent while the domain logic is still under construction.
 */
import { type NextFunction, type Request, type Response } from "express";
import { ZodError } from "zod";

import { logger } from "../config/logger.js";

type HttpError = Error & {
  statusCode?: number;
  expose?: boolean;
  details?: unknown;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(
  err: HttpError,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // Normalize schema validation errors into a client-safe 400 response.
  const isValidationError = err instanceof ZodError;
  const statusCode = isValidationError ? 400 : err.statusCode ?? 500;
  const expose = isValidationError ? true : err.expose ?? statusCode < 500;
  const details = isValidationError ? err.flatten() : err.details;
  const message = isValidationError ? "Validation failed." : err.message;

  const logPayload = {
    err,
    statusCode,
    details,
  };

  if (statusCode < 500) {
    logger.warn(logPayload, "Request rejected");
  } else {
    logger.error(logPayload, "Unhandled backend error");
  }

  const payload = expose
    ? { message, details }
    : { message: "Internal Server Error" };

  res.status(statusCode).json(payload);
}
