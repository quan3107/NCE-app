/**
 * File: src/modules/users/users.service.ts
 * Purpose: Implement user CRUD workflows backed by Prisma.
 * Why: Keeps the domain logic isolated from Express concerns for clean layering.
 */
import { UserRole, UserStatus } from '../../prisma/index.js'
import { prisma, runWithRole } from '../../prisma/client.js'
import { isUniqueConstraintError } from '../auth/auth.errors.js'
import { writeAuditLogSafely } from '../audit-logs/audit-logs.service.js'
import { createHttpError, createNotFoundError } from '../../utils/httpError.js'
import {
  createUserSchema,
  DEFAULT_USER_LIMIT,
  inviteUserSchema,
  managedUserStatusSchema,
  userQuerySchema,
  userIdParamsSchema,
} from './users.schema.js'

type UserActor = {
  id: string
}

const userSelect = {
  id: true,
  email: true,
  fullName: true,
  role: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
}

export async function listUsers(query: unknown) {
  const { limit: rawLimit, offset: rawOffset } = userQuerySchema.parse(query)
  const limit = rawLimit ?? DEFAULT_USER_LIMIT
  const offset = rawOffset ?? 0

  return prisma.user.findMany({
    where: { deletedAt: null },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit,
    skip: offset,
    // Exclude password hashes from API responses.
    select: userSelect,
  })
}

export async function getUserById(params: unknown) {
  const { userId } = userIdParamsSchema.parse(params)
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: userSelect,
  })
  if (!user) {
    throw createNotFoundError('User', userId)
  }
  return user
}

export async function createUser(payload: unknown, actor: UserActor) {
  const data = createUserSchema.parse(payload)
  const user = await prisma.user.create({
    data: {
      email: data.email,
      fullName: data.fullName,
      role: data.role,
      status: data.status,
    },
    select: userSelect,
  })

  await writeAuditLogSafely({
    actorId: actor.id,
    action: 'user.created',
    entity: 'user',
    entityId: user.id,
    eventData: {
      role: user.role,
      status: user.status,
    },
  })

  return user
}

export async function inviteUser(payload: unknown, actor: UserActor) {
  const data = inviteUserSchema.parse(payload)

  try {
    const user = await prisma.$transaction(async (tx) =>
      tx.user.create({
        data: {
          email: data.email,
          fullName: data.fullName,
          role: data.role,
          status: UserStatus.invited,
        },
        select: userSelect,
      }),
    )

    await writeAuditLogSafely({
      actorId: actor.id,
      action: 'user.invited',
      entity: 'user',
      entityId: user.id,
      eventData: {
        role: user.role,
        status: user.status,
      },
    })

    return user
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw createHttpError(409, 'An account with that email already exists.')
    }
    throw error
  }
}

export async function approveTeacherRequest(params: unknown, actor: UserActor) {
  const { userId } = userIdParamsSchema.parse(params)
  return transitionPendingTeacher({
    userId,
    actor,
    nextStatus: UserStatus.active,
  })
}

export async function rejectTeacherRequest(params: unknown, actor: UserActor) {
  const { userId } = userIdParamsSchema.parse(params)
  return transitionPendingTeacher({
    userId,
    actor,
    nextStatus: UserStatus.suspended,
  })
}

export async function updateManagedUserStatus(
  params: unknown,
  payload: unknown,
  actor: UserActor,
) {
  const { userId } = userIdParamsSchema.parse(params)
  const { status } = managedUserStatusSchema.parse(payload)
  assertManageableUser(userId, actor)
  const previousStatus =
    status === UserStatus.suspended ? UserStatus.active : UserStatus.suspended
  const now = new Date()

  const updated = await runWithRole({ role: 'service_role' }, () =>
    prisma.$transaction(async (tx) => {
      const result = await tx.user.updateMany({
        where: {
          id: userId,
          role: { not: UserRole.admin },
          status: previousStatus,
          deletedAt: null,
        },
        data: { status },
      })
      if (result.count === 0) {
        await throwManagedUserConflict(tx, userId)
      }
      if (status === UserStatus.suspended) {
        await revokeManagedUserSessions(tx, userId, now)
      }
      const user = await tx.user.findFirst({
        where: { id: userId, deletedAt: null },
        select: userSelect,
      })
      if (!user) throw createNotFoundError('User', userId)
      return user
    }),
  )

  await writeAuditLogSafely({
    actorId: actor.id,
    action: 'user.status_changed',
    entity: 'user',
    entityId: userId,
    eventData: { previousStatus, status },
  })
  return updated
}

export async function deleteManagedUser(params: unknown, actor: UserActor) {
  const { userId } = userIdParamsSchema.parse(params)
  assertManageableUser(userId, actor)
  const now = new Date()

  await runWithRole({ role: 'service_role' }, () =>
    prisma.$transaction(async (tx) => {
      const result = await tx.user.updateMany({
        where: {
          id: userId,
          role: { not: UserRole.admin },
          deletedAt: null,
        },
        data: { deletedAt: now, status: UserStatus.suspended },
      })
      if (result.count === 0) {
        await throwManagedUserConflict(tx, userId)
      }
      await revokeManagedUserSessions(tx, userId, now)
    }),
  )

  await writeAuditLogSafely({
    actorId: actor.id,
    action: 'user.deleted',
    entity: 'user',
    entityId: userId,
    eventData: { softDeleted: true },
  })
}

function assertManageableUser(userId: string, actor: UserActor): void {
  if (userId === actor.id) {
    throw createHttpError(409, 'Administrators cannot change their own account here.')
  }
}

async function throwManagedUserConflict(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  userId: string,
): Promise<never> {
  const current = await tx.user.findFirst({
    where: { id: userId },
    select: { role: true, status: true, deletedAt: true },
  })
  if (!current || current.deletedAt) throw createNotFoundError('User', userId)
  if (current.role === UserRole.admin) {
    throw createHttpError(409, 'Administrator accounts cannot be changed here.')
  }
  throw createHttpError(409, 'The user status changed before this action completed.', {
    status: current.status,
  })
}

async function revokeManagedUserSessions(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  userId: string,
  revokedAt: Date,
): Promise<void> {
  await tx.authSession.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt },
  })
}

async function transitionPendingTeacher(input: {
  userId: string
  actor: UserActor
  nextStatus: UserStatus
}) {
  const updated = await prisma.$transaction(async (tx) => {
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
    })

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
      })

      if (!current || current.role !== UserRole.teacher) {
        throw createNotFoundError('Teacher request', input.userId)
      }

      throw createHttpError(409, 'Only pending teacher requests can be transitioned.', {
        status: current.status,
      })
    }

    const updated = await tx.user.findFirst({
      where: {
        id: input.userId,
        deletedAt: null,
      },
      select: userSelect,
    })

    if (!updated) {
      throw createNotFoundError('Teacher request', input.userId)
    }

    return updated
  })

  if (input.nextStatus === UserStatus.active) {
    await writeAuditLogSafely({
      actorId: input.actor.id,
      action: 'user.teacher_approved',
      entity: 'user',
      entityId: updated.id,
      eventData: {
        previousStatus: 'pending',
        status: 'active',
      },
    })
  } else {
    await writeAuditLogSafely({
      actorId: input.actor.id,
      action: 'user.teacher_rejected',
      entity: 'user',
      entityId: updated.id,
      eventData: {
        previousStatus: 'pending',
        status: 'suspended',
      },
    })
  }

  return updated
}
