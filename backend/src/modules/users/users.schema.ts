/**
 * File: src/modules/users/users.schema.ts
 * Purpose: Capture validation contracts for user management endpoints.
 * Why: Guarantees consistent parsing for user CRUD flows once implemented.
 */
import { z } from "zod";

import { UserRole, UserStatus } from "../../prisma/index.js";

export const DEFAULT_USER_LIMIT = 50;
const MAX_USER_LIMIT = 100;
const USER_ROLES = [UserRole.admin, UserRole.teacher, UserRole.student] as const;
const INVITABLE_USER_ROLES = [UserRole.teacher, UserRole.student] as const;
const USER_STATUSES = [
  UserStatus.active,
  UserStatus.pending,
  UserStatus.invited,
  UserStatus.suspended,
] as const;

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
  role: z.enum(USER_ROLES),
  status: z.enum(USER_STATUSES).default(UserStatus.invited),
});

export const inviteUserSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  fullName: z.string().trim().min(1),
  role: z.enum(INVITABLE_USER_ROLES),
});
