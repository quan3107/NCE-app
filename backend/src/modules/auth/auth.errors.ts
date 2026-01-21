/**
 * File: src/modules/auth/auth.errors.ts
 * Purpose: Provide shared auth error helpers and messages.
 * Why: Keeps auth error shaping consistent across service modules.
 */
import { Prisma } from "@prisma/client";

export const AUTH_ERROR = "Invalid email or password";

export const createAuthError = (
  statusCode: number,
  message: string,
): Error & { statusCode: number; expose: boolean } => {
  const error = new Error(message) as Error & {
    statusCode: number;
    expose: boolean;
  };
  error.statusCode = statusCode;
  error.expose = statusCode < 500;
  return error;
};

export const isUniqueConstraintError = (
  error: unknown,
): error is Prisma.PrismaClientKnownRequestError =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === "P2002";
