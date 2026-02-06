/**
 * File: src/middleware/authGuard.ts
 * Purpose: Enforce authenticated requests by validating lightweight header-based credentials.
 * Why: Provides a temporary access guard until full token verification is wired up.
 */
import { UserRole } from "../prisma/index.js";
import { type NextFunction, type Request, type Response } from "express";
import { z } from "zod";

import { verifyAccessToken } from "../modules/auth/auth.tokens.js";

const headerSchema = z.object({
  userId: z.string().uuid(),
  role: z.nativeEnum(UserRole),
});

const unauthorizedResponse = {
  message: "Unauthorized",
};

const isUserRole = (value: unknown): value is UserRole =>
  value === UserRole.admin ||
  value === UserRole.teacher ||
  value === UserRole.student;

function handleBearerAuth(req: Request): { id: string; role: UserRole } | null {
  const authorizationHeader = req.header("authorization");

  if (!authorizationHeader) {
    return null;
  }

  const match = authorizationHeader.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    throw new Error("Invalid authorization header format");
  }

  const token = match[1]?.trim();

  if (!token) {
    throw new Error("Missing bearer token");
  }

  const claims = verifyAccessToken(token);
  const role = claims.role;

  if (!claims.sub || !isUserRole(role)) {
    throw new Error("Invalid token claims");
  }

  return { id: claims.sub, role };
}

export function authGuard(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  try {
    const bearerUser = handleBearerAuth(req);
    if (bearerUser) {
      req.user = bearerUser;
      next();
      return;
    }
  } catch {
    res.status(401).json(unauthorizedResponse);
    return;
  }

  const parseResult = headerSchema.safeParse({
    userId: req.header("x-user-id"),
    role: req.header("x-user-role"),
  });

  if (!parseResult.success) {
    res.status(401).json(unauthorizedResponse);
    return;
  }

  req.user = {
    id: parseResult.data.userId,
    role: parseResult.data.role,
  };

  next();
}
