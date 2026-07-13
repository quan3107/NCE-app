/**
 * File: tests/modules/users/users.service.test.ts
 * Purpose: Validate admin user invitation and teacher approval transitions.
 * Why: Ensures public teacher requests cannot become active without admin action.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { UserRole, UserStatus } from '../../../src/prisma/index.js'

vi.mock('../../../src/prisma/client.js', () => ({
  prisma: {
    user: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

const prismaModule = await import('../../../src/prisma/client.js')
const prisma = vi.mocked(prismaModule.prisma, true)
const transactionAuditLogCreate = vi.fn()

const { approveTeacherRequest, createUser, inviteUser, rejectTeacherRequest } =
  await import('../../../src/modules/users/users.service.js')

const actor = {
  id: '7f6c9f72-1e95-4f36-8f06-0f0a9ed0b1c2',
  role: UserRole.admin,
  status: UserStatus.active,
}

const pendingTeacher = {
  id: '8f6c9f72-1e95-4f36-8f06-0f0a9ed0b1c3',
  email: 'teacher@example.com',
  fullName: 'Pending Teacher',
  role: UserRole.teacher,
  status: UserStatus.pending,
  createdAt: new Date('2026-05-29T00:00:00.000Z'),
  updatedAt: new Date('2026-05-29T00:00:00.000Z'),
  deletedAt: null,
}

describe('users.service teacher approvals', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    transactionAuditLogCreate.mockReset()
    prisma.$transaction.mockImplementation(async (callback: unknown) => {
      if (typeof callback !== 'function') {
        return callback
      }

      return callback({
        user: {
          create: prisma.user.create,
          findFirst: prisma.user.findFirst,
          update: prisma.user.update,
          updateMany: prisma.user.updateMany,
        },
        auditLog: {
          create: transactionAuditLogCreate,
        },
      })
    })
  })

  it('audits admin-created users', async () => {
    const createdUser = {
      ...pendingTeacher,
      status: UserStatus.active,
    }
    prisma.user.create.mockResolvedValueOnce(createdUser)

    const result = await createUser(
      {
        email: 'Teacher@Example.com',
        fullName: 'New Teacher',
        role: UserRole.teacher,
        status: UserStatus.active,
      },
      actor,
    )

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: actor.id,
        action: 'user.created',
        entity: 'user',
        entityId: createdUser.id,
        diff: expect.objectContaining({
          changes: expect.objectContaining({
            role: { to: UserRole.teacher },
            status: { to: UserStatus.active },
          }),
        }),
      }),
      select: { id: true },
    })
    expect(result).toBe(createdUser)
  })

  it('approves pending teacher requests and writes an audit entry', async () => {
    prisma.user.updateMany.mockResolvedValueOnce({ count: 1 })
    prisma.user.findFirst.mockResolvedValueOnce({
      ...pendingTeacher,
      status: UserStatus.active,
    })

    const result = await approveTeacherRequest({ userId: pendingTeacher.id }, actor)

    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: {
        id: pendingTeacher.id,
        role: UserRole.teacher,
        status: UserStatus.pending,
        deletedAt: null,
      },
      data: { status: UserStatus.active },
    })
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        actorId: actor.id,
        action: 'user.teacher_approved',
        entity: 'user',
        entityId: pendingTeacher.id,
        diff: {
          changes: {
            status: {
              from: UserStatus.pending,
              to: UserStatus.active,
            },
          },
        },
      },
      select: { id: true },
    })
    expect(transactionAuditLogCreate).not.toHaveBeenCalled()
    expect(result.status).toBe(UserStatus.active)
  })

  it('rejects pending teacher requests by suspending them', async () => {
    prisma.user.updateMany.mockResolvedValueOnce({ count: 1 })
    prisma.user.findFirst.mockResolvedValueOnce({
      ...pendingTeacher,
      status: UserStatus.suspended,
    })

    const result = await rejectTeacherRequest({ userId: pendingTeacher.id }, actor)

    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: {
        id: pendingTeacher.id,
        role: UserRole.teacher,
        status: UserStatus.pending,
        deletedAt: null,
      },
      data: { status: UserStatus.suspended },
    })
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'user.teacher_rejected',
        }),
      }),
    )
    expect(transactionAuditLogCreate).not.toHaveBeenCalled()
    expect(result.status).toBe(UserStatus.suspended)
  })

  it('does not transition teachers that are not pending', async () => {
    prisma.user.updateMany.mockResolvedValueOnce({ count: 0 })
    prisma.user.findFirst.mockResolvedValueOnce({
      role: UserRole.teacher,
      status: UserStatus.active,
    })

    await expect(
      approveTeacherRequest({ userId: pendingTeacher.id }, actor),
    ).rejects.toMatchObject({
      statusCode: 409,
    })

    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: {
        id: pendingTeacher.id,
        role: UserRole.teacher,
        status: UserStatus.pending,
        deletedAt: null,
      },
      data: { status: UserStatus.active },
    })
    expect(prisma.auditLog.create).not.toHaveBeenCalled()
  })

  it('invites teachers and students with invited status', async () => {
    prisma.user.create.mockResolvedValueOnce({
      ...pendingTeacher,
      status: UserStatus.invited,
    })

    const result = await inviteUser(
      {
        email: ' Teacher@Example.com ',
        fullName: ' Invited Teacher ',
        role: 'teacher',
      },
      actor,
    )

    expect(prisma.user.create).toHaveBeenCalledWith({
      data: {
        email: 'teacher@example.com',
        fullName: 'Invited Teacher',
        role: UserRole.teacher,
        status: UserStatus.invited,
      },
      select: expect.any(Object),
    })
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'user.invited',
          actorId: actor.id,
        }),
      }),
    )
    expect(transactionAuditLogCreate).not.toHaveBeenCalled()
    expect(result.status).toBe(UserStatus.invited)
  })

  it('does not fail invitations when audit writing fails', async () => {
    prisma.user.create.mockResolvedValueOnce({
      ...pendingTeacher,
      status: UserStatus.invited,
    })
    prisma.auditLog.create.mockRejectedValueOnce(new Error('audit failed'))

    const result = await inviteUser(
      {
        email: 'Teacher@Example.com',
        fullName: 'Invited Teacher',
        role: 'teacher',
      },
      actor,
    )

    expect(result.status).toBe(UserStatus.invited)
    expect(prisma.auditLog.create).toHaveBeenCalled()
    expect(transactionAuditLogCreate).not.toHaveBeenCalled()
  })
})
