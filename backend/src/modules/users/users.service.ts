/**
 * File: src/modules/users/users.service.ts
 * Purpose: Implement user CRUD workflows backed by Prisma.
 * Why: Keeps the domain logic isolated from Express concerns for clean layering.
 */
import { prisma } from "../../prisma/client.js";
import { createNotFoundError } from "../../utils/httpError.js";
import {
  createUserSchema,
  userIdParamsSchema,
} from "./users.schema.js";

const userSelect = {
  id: true,
  email: true,
  fullName: true,
  role: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
};

export async function listUsers() {
  return prisma.user.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
    // Exclude password hashes from API responses.
    select: userSelect,
  });
}

export async function getUserById(params: unknown) {
  const { userId } = userIdParamsSchema.parse(params);
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: userSelect,
  });
  if (!user) {
    throw createNotFoundError("User", userId);
  }
  return user;
}

export async function createUser(payload: unknown) {
  const data = createUserSchema.parse(payload);
  return prisma.user.create({
    data: {
      email: data.email,
      fullName: data.fullName,
      role: data.role,
      status: data.status,
    },
    select: userSelect,
  });
}
