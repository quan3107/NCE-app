/**
 * File: src/modules/users/users.service.ts
 * Purpose: Host the business logic stubs for user CRUD and lookup workflows.
 * Why: Keeps the domain logic isolated from Express concerns for clean layering.
 */
import {
  createUserSchema,
  userIdParamsSchema,
} from "./users.schema.js";

export async function listUsers(): Promise<void> {
  // Listing users will query Prisma in a future iteration.
}

export async function getUserById(params: unknown): Promise<void> {
  userIdParamsSchema.parse(params);
}

export async function createUser(payload: unknown): Promise<void> {
  createUserSchema.parse(payload);
}
