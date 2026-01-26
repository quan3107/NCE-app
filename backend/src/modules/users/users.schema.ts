/**
 * File: src/modules/users/users.schema.ts
 * Purpose: Capture validation contracts for user management endpoints.
 * Why: Guarantees consistent parsing for user CRUD flows once implemented.
 */
import { z } from "zod";

export const DEFAULT_USER_LIMIT = 50;
const MAX_USER_LIMIT = 100;

export const userIdParamsSchema = z.object({
  userId: z.string().uuid(),
});

export const userQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(MAX_USER_LIMIT).optional(),
    offset: z.coerce.number().int().min(0).optional(),
  })
  .strict();

export const createUserSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(1),
  role: z.enum(["admin", "teacher", "student"]),
  status: z.enum(["active", "invited", "suspended"]).default("invited"),
});
