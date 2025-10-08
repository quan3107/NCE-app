/**
 * File: src/modules/auth/auth.schema.ts
 * Purpose: Define validation schemas for upcoming authentication endpoints.
 * Why: Ensures request parsing is explicit and reusable once logic lands.
 */
import { z } from "zod";

export const passwordLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const refreshSessionSchema = z.object({
  refreshToken: z.string().min(1),
});

export const googleAuthCallbackSchema = z.object({
  code: z.string().min(1),
  state: z.string().optional(),
});
