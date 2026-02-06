/**
 * File: src/middleware/roleGuard.ts
 * Purpose: Enforce role-based access control based on the authenticated request context.
 * Why: Ensures only allowed roles can access protected routes once authentication is verified.
 */
import { UserRole } from "../prisma/index.js";
import { type NextFunction, type Request, type Response } from "express";

export function roleGuard(
  requiredRoles: readonly UserRole[],
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction) => {
    const actor = req.user;
    if (!actor) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    if (requiredRoles.length === 0) {
      next();
      return;
    }

    if (!requiredRoles.includes(actor.role)) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    next();
  };
}
