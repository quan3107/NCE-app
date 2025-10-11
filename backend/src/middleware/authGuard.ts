/**
 * File: src/middleware/authGuard.ts
 * Purpose: Enforce authenticated requests by validating lightweight header-based credentials.
 * Why: Provides a temporary access guard until full token verification is wired up.
 */
import { UserRole } from "@prisma/client";
import { type NextFunction, type Request, type Response } from "express";
import { z } from "zod";

const headerSchema = z.object({
  userId: z.string().uuid(),
  role: z.nativeEnum(UserRole),
});

const unauthorizedResponse = {
  message: "Unauthorized",
};

export function authGuard(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
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
