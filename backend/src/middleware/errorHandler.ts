/**
 * File: src/middleware/errorHandler.ts
 * Purpose: Central Express error handler that emits structured responses and logs details.
 * Why: Keeps error reporting consistent while the domain logic is still under construction.
 */
import { type NextFunction, type Request, type Response } from "express";

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
  const statusCode = err.statusCode ?? 500;
  const expose = err.expose ?? statusCode < 500;

  logger.error(
    {
      err,
      statusCode,
      details: err.details,
    },
    "Unhandled backend error",
  );

  const payload = expose
    ? { message: err.message, details: err.details }
    : { message: "Internal Server Error" };

  res.status(statusCode).json(payload);
}
