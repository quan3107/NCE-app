/**
 * File: src/middleware/roleGuard.ts
 * Purpose: Stub middleware that will eventually enforce role-based access control for course resources.
 * Why: Establishes the contract for future authorization logic without blocking early API iteration.
 */
import { type NextFunction, type Request, type Response } from "express";

export function roleGuard(
  _requiredRoles: string[],
): (req: Request, res: Response, next: NextFunction) => void {
  return (_req: Request, _res: Response, next: NextFunction) => {
    next();
  };
}
