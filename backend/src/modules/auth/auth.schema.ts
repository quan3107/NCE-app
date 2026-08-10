/**
 * File: src/modules/auth/auth.schema.ts
 * Purpose: Define validation schemas for upcoming authentication endpoints.
 * Why: Ensures request parsing is explicit and reusable once logic lands.
 */
import { UserRole } from "../../prisma/index.js";
import { normalizedDisplayNameSchema } from "../../utils/displayNameValidation.js";
import { z } from "zod";

const REGISTERABLE_ROLES = [
  UserRole.student,
  UserRole.teacher,
] as const;

export const passwordLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, "Password is required"),
});

export const refreshSessionSchema = z.object({
  refreshToken: z.string().min(1),
});

export const googleAuthCallbackSchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
});

export const registerAccountSchema = z.object({
  fullName: normalizedDisplayNameSchema,
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8),
  role: z.enum(REGISTERABLE_ROLES),
});
