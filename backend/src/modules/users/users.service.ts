/**
 * File: src/modules/users/users.service.ts
 * Purpose: Implement user CRUD workflows backed by Prisma.
 * Why: Keeps the domain logic isolated from Express concerns for clean layering.
 */
import { UserRole, UserStatus } from "../../prisma/index.js";
import { prisma } from "../../prisma/client.js";
import { isUniqueConstraintError } from "../auth/auth.errors.js";
import { writeAuditLogSafely } from "../audit-logs/audit-logs.service.js";
import { createHttpError, createNotFoundError } from "../../utils/httpError.js";
import {
  createUserSchema,
  DEFAULT_USER_LIMIT,
  inviteUserSchema,
  userQuerySchema,
  userIdParamsSchema,
} from "./users.schema.js";

type UserActor = {
  id: string;
};

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

export async function listUsers(query: unknown) {
  const { limit: rawLimit, offset: rawOffset } =
    userQuerySchema.parse(query);
  const limit = rawLimit ?? DEFAULT_USER_LIMIT;
  const offset = rawOffset ?? 0;

  return prisma.user.findMany({
    where: { deletedAt: null },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit,
    skip: offset,
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

export async function inviteUser(payload: unknown, actor: UserActor) {
  const data = inviteUserSchema.parse(payload);

  try {
    return await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: data.email,
          fullName: data.fullName,
          role: data.role,
          status: UserStatus.invited,
        },
        select: userSelect,
      });

      await writeAuditLogSafely(
        {
          actorId: actor.id,
          action: "user.invited",
          entity: "user",
          entityId: user.id,
          diff: {
            role: { to: user.role },
            status: { to: user.status },
          },
        },
        tx,
      );

      return user;
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw createHttpError(409, "An account with that email already exists.");
    }
    throw error;
  }
}

export async function approveTeacherRequest(
  params: unknown,
  actor: UserActor,
) {
  const { userId } = userIdParamsSchema.parse(params);
  return transitionPendingTeacher({
    userId,
    actor,
    nextStatus: UserStatus.active,
    auditAction: "user.teacher_approved",
  });
}

export async function rejectTeacherRequest(
  params: unknown,
  actor: UserActor,
) {
  const { userId } = userIdParamsSchema.parse(params);
  return transitionPendingTeacher({
    userId,
    actor,
    nextStatus: UserStatus.suspended,
    auditAction: "user.teacher_rejected",
  });
}

async function transitionPendingTeacher(input: {
  userId: string;
  actor: UserActor;
  nextStatus: UserStatus;
  auditAction: string;
}) {
  return prisma.$transaction(async (tx) => {
    const result = await tx.user.updateMany({
      where: {
        id: input.userId,
        role: UserRole.teacher,
        status: UserStatus.pending,
        deletedAt: null,
      },
      data: {
        status: input.nextStatus,
      },
    });

    if (result.count === 0) {
      const current = await tx.user.findFirst({
        where: {
          id: input.userId,
          deletedAt: null,
        },
        select: {
          role: true,
          status: true,
        },
      });

      if (!current || current.role !== UserRole.teacher) {
        throw createNotFoundError("Teacher request", input.userId);
      }

      throw createHttpError(
        409,
        "Only pending teacher requests can be transitioned.",
        {
          status: current.status,
        },
      );
    }

    const updated = await tx.user.findFirst({
      where: {
        id: input.userId,
        deletedAt: null,
      },
      select: userSelect,
    });

    if (!updated) {
      throw createNotFoundError("Teacher request", input.userId);
    }

    await writeAuditLogSafely(
      {
        actorId: input.actor.id,
        action: input.auditAction,
        entity: "user",
        entityId: updated.id,
        diff: {
          status: {
            from: UserStatus.pending,
            to: input.nextStatus,
          },
        },
      },
      tx,
    );

    return updated;
  });
}
