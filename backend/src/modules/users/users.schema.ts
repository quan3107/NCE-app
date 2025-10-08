/**
 * File: src/modules/users/users.schema.ts
 * Purpose: Capture validation contracts for user management endpoints.
 * Why: Guarantees consistent parsing for user CRUD flows once implemented.
 */
import { z } from "zod";

export const userIdParamsSchema = z.object({
  userId: z.string().uuid(),
});

export const createUserSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(1),
  role: z.enum(["admin", "teacher", "student"]),
  status: z.enum(["active", "invited", "suspended"]).default("invited"),
});
