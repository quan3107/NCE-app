/**
 * File: src/middleware/authGuard.ts
 * Purpose: Enforce authenticated requests by validating Bearer tokens (production) or header-based credentials (dev/test only).
 * Why: Prevents unauthenticated access while preserving developer convenience in non-production environments.
 */
import { type NextFunction, type Request, type Response } from "express";

import {
  isActiveActor,
  resolveAuthoritativeRequestActor,
} from "./requestActor.js";

const unauthorizedResponse = {
  message: "Unauthorized",
};

export async function authGuard(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const resolved =
    req.authActorResolution ?? (await resolveAuthoritativeRequestActor(req));
  if (resolved.kind === "invalid" || resolved.kind === "anonymous") {
    res.status(401).json(unauthorizedResponse);
    return;
  }

  if (!isActiveActor(resolved.actor)) {
    res.status(403).json({ message: "Forbidden" });
    return;
  }

  req.user = resolved.actor;
  next();
}
