/**
 * File: src/middleware/rlsContext.ts
 * Purpose: Set per-request database role + RLS context for Prisma queries.
 * Why: Ensures RLS policies enforce tenant access for all API requests.
 */
import { type NextFunction, type Request, type Response } from "express";

import { withRoleContext } from "../prisma/client.js";
import { isActiveActor, resolveRequestActor } from "./requestActor.js";

export async function rlsContext(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  if (req.path.startsWith("/auth")) {
    next();
    return;
  }

  const resolvedActor = resolveRequestActor(req);
  const actor =
    resolvedActor.kind === "authenticated" && isActiveActor(resolvedActor.actor)
      ? resolvedActor.actor
      : null;
  // Share parsed actor with downstream handlers so optional-auth routes can
  // still apply role-scoped service logic without requiring authGuard.
  req.user = actor ?? undefined;
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
