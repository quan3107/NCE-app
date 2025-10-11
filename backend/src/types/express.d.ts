/**
 * File: src/types/express.d.ts
 * Purpose: Augment Express request typing with the authenticated user context.
 * Why: Allows middleware to attach the logged-in user while keeping TypeScript aware downstream.
 */
import type { UserRole } from "@prisma/client";

declare module "express-serve-static-core" {
  interface Request {
    user?: {
      id: string;
      role: UserRole;
    };
  }
}

