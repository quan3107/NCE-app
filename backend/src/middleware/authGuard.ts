/**
 * File: src/middleware/authGuard.ts
 * Purpose: Placeholder Express middleware enforcing authenticated requests once auth is implemented.
 * Why: Reserves the extension point for future token/session verification while allowing scaffolding to compile.
 */
import { type NextFunction, type Request, type Response } from "express";

export function authGuard(
  _req: Request,
  _res: Response,
  next: NextFunction,
): void {
  next();
}
