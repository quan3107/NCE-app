/**
 * File: src/middleware/rlsContext.ts
 * Purpose: Set per-request database role + RLS context for Prisma queries.
 * Why: Ensures RLS policies enforce tenant access for all API requests.
 */
import { UserRole } from "@prisma/client";
import { type NextFunction, type Request, type Response } from "express";
import { z } from "zod";

import { withRoleContext } from "../prisma/client.js";
import { verifyAccessToken } from "../modules/auth/auth.tokens.js";

const headerSchema = z.object({
  userId: z.string().uuid(),
  role: z.nativeEnum(UserRole),
});

type Actor = { id: string; role: UserRole };

function parseBearerActor(req: Request): Actor | null {
  const authorizationHeader = req.header("authorization");
  if (!authorizationHeader) {
    return null;
  }

  const match = authorizationHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return null;
  }

  const token = match[1]?.trim();
  if (!token) {
    return null;
  }

  try {
    const claims = verifyAccessToken(token);
    if (!claims.sub || typeof claims.role !== "string") {
      return null;
    }
    if (!Object.values(UserRole).includes(claims.role as UserRole)) {
      return null;
    }
    return { id: claims.sub, role: claims.role as UserRole };
  } catch {
    return null;
  }
}

function parseHeaderActor(req: Request): Actor | null {
  const parseResult = headerSchema.safeParse({
    userId: req.header("x-user-id"),
    role: req.header("x-user-role"),
  });
  if (!parseResult.success) {
    return null;
  }
  return { id: parseResult.data.userId, role: parseResult.data.role };
}

function resolveActor(req: Request): Actor | null {
  return parseBearerActor(req) ?? parseHeaderActor(req);
}

export async function rlsContext(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  if (req.path.startsWith("/auth")) {
    next();
    return;
  }

  const actor = resolveActor(req);
  const role = actor ? "authenticated" : "anon";
  const userRole = actor?.role ?? "anon";
  const userId = actor?.id ?? "";

  try {
    withRoleContext({ role, userId, userRole }, () => {
      next();
    });
  } catch (error) {
    next(error);
  }
}
