/**
 * File: tests/modules/audit-logs/audit-logs.service.test.ts
 * Purpose: Verify typed audit writing, runtime contracts, and filtering.
 * Why: Only reviewed operational event data may cross the persistence boundary.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../src/prisma/client.js', () => ({
  prisma: {
    auditLog: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}))

vi.mock('../../../src/config/logger.js', () => ({
  logger: {
    warn: vi.fn(),
  },
}))

const prismaModule = await import('../../../src/prisma/client.js')
const loggerModule = await import('../../../src/config/logger.js')
const prisma = vi.mocked(prismaModule.prisma, true)
const logger = vi.mocked(loggerModule.logger, true)

const { listAuditLogs, writeAuditLog, writeAuditLogSafely } =
  await import('../../../src/modules/audit-logs/audit-logs.service.js')

describe('audit log service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('writes registered event data with its schema version', async () => {
    prisma.auditLog.create.mockResolvedValueOnce({ id: 'audit-1' } as never)

    await writeAuditLog({
      actorId: '7f6c9f72-1e95-4f36-8f06-0f0a9ed0b1c2',
      action: 'course.created',
      entity: 'course',
      entityId: '6c986d3c-5d72-40d4-96b5-b5e3725c9811',
      eventData: {
        ownerTeacherId: '7f6c9f72-1e95-4f36-8f06-0f0a9ed0b1c2',
      },
    })

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        actorId: '7f6c9f72-1e95-4f36-8f06-0f0a9ed0b1c2',
        action: 'course.created',
        entity: 'course',
        entityId: '6c986d3c-5d72-40d4-96b5-b5e3725c9811',
        eventData: {
          ownerTeacherId: '7f6c9f72-1e95-4f36-8f06-0f0a9ed0b1c2',
        },
        schemaVersion: 1,
      },
      select: { id: true },
    })
  })

  it.each([
    {
      name: 'unregistered actions',
      input: {
        action: 'submission.updated',
        entity: 'submission',
        eventData: { submissionContentChanged: true },
      },
    },
    {
      name: 'unknown properties',
      input: {
        action: 'course.created',
        entity: 'course',
        eventData: {
          ownerTeacherId: '7f6c9f72-1e95-4f36-8f06-0f0a9ed0b1c2',
          title: 'Private course title',
        },
      },
    },
    {
      name: 'complete records',
      input: {
        action: 'course.created',
        entity: 'course',
        eventData: {
          id: '6c986d3c-5d72-40d4-96b5-b5e3725c9811',
          ownerTeacherId: '7f6c9f72-1e95-4f36-8f06-0f0a9ed0b1c2',
          description: 'Full database record',
          createdAt: '2026-06-30T04:15:00.000Z',
        },
      },
    },
    {
      name: 'private content',
      input: {
        action: 'grade.upserted',
        entity: 'grade',
        eventData: {
          submissionId: '6c986d3c-5d72-40d4-96b5-b5e3725c9811',
          feedbackMd: 'Clear organization.',
        },
      },
    },
  ])('rejects $name before persistence', async ({ input }) => {
    await expect(
      writeAuditLog({
        actorId: '7f6c9f72-1e95-4f36-8f06-0f0a9ed0b1c2',
        entityId: '6c986d3c-5d72-40d4-96b5-b5e3725c9811',
        ...input,
      } as never),
    ).rejects.toThrow()

    expect(prisma.auditLog.create).not.toHaveBeenCalled()
  })

  it('logs and swallows audit insertion failures for safe writes', async () => {
    const error = new Error('insert failed')
    prisma.auditLog.create.mockRejectedValueOnce(error as never)

    await expect(
      writeAuditLogSafely({
        actorId: '7f6c9f72-1e95-4f36-8f06-0f0a9ed0b1c2',
        action: 'course.updated',
        entity: 'course',
        entityId: 'course-1',
        eventData: { titleChanged: true },
      }),
    ).resolves.toBeUndefined()

    expect(logger.warn).toHaveBeenCalledWith(
      {
        err: error,
        action: 'course.updated',
        entity: 'course',
        entityId: 'course-1',
      },
      'Audit log write failed.',
    )
  })

  it('applies admin audit log filters and offset pagination', async () => {
    prisma.auditLog.findMany.mockResolvedValueOnce([
      { id: 'audit-1' },
      { id: 'audit-2' },
      { id: 'audit-3' },
    ] as never)

    const result = await listAuditLogs({
      actorId: '7f6c9f72-1e95-4f36-8f06-0f0a9ed0b1c2',
      entity: 'submission',
      entityId: '6c986d3c-5d72-40d4-96b5-b5e3725c9811',
      action: 'submission.updated',
      from: new Date('2026-06-01T00:00:00.000Z'),
      to: new Date('2026-06-30T23:59:59.000Z'),
      limit: 2,
      offset: 4,
    })

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          deletedAt: null,
          actorId: '7f6c9f72-1e95-4f36-8f06-0f0a9ed0b1c2',
          entity: 'submission',
          entityId: '6c986d3c-5d72-40d4-96b5-b5e3725c9811',
          action: 'submission.updated',
          createdAt: {
            gte: new Date('2026-06-01T00:00:00.000Z'),
            lte: new Date('2026-06-30T23:59:59.000Z'),
          },
        },
        take: 3,
        skip: 4,
      }),
    )
    expect(result).toEqual({
      data: [{ id: 'audit-1' }, { id: 'audit-2' }],
      nextOffset: 6,
    })
  })
})
