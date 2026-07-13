/**
 * File: tests/modules/audit-logs/audit-logs.service.test.ts
 * Purpose: Verify centralized audit writing, redaction, and filtering.
 * Why: Mutation audit trails must be reusable and safe for sensitive records.
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

  it('writes centralized audit rows with redacted sensitive payloads', async () => {
    prisma.auditLog.create.mockResolvedValueOnce({ id: 'audit-1' } as never)

    await writeAuditLog({
      actorId: '7f6c9f72-1e95-4f36-8f06-0f0a9ed0b1c2',
      action: 'submission.updated',
      entity: 'submission',
      entityId: '6c986d3c-5d72-40d4-96b5-b5e3725c9811',
      before: {
        status: 'draft',
        payload: {
          responseText: 'This is a private student essay.',
          attachments: [{ objectKey: 'private/submission-key.pdf' }],
        },
      },
      after: {
        status: 'submitted',
        payload: {
          responseText: 'This is a private student essay with more text.',
          accessToken: 'secret-token',
        },
      },
      diff: {
        status: { from: 'draft', to: 'submitted' },
      },
      requestMetadata: {
        ipAddress: '203.0.113.10',
        userAgent: 'Vitest',
        authorization: 'Bearer secret',
      },
    })

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        actorId: '7f6c9f72-1e95-4f36-8f06-0f0a9ed0b1c2',
        action: 'submission.updated',
        entity: 'submission',
        entityId: '6c986d3c-5d72-40d4-96b5-b5e3725c9811',
        diff: {
          before: {
            status: 'draft',
            payload: {
              responseText: expect.objectContaining({
                redacted: true,
                hash: expect.stringMatching(/^sha256:/),
                length: 32,
              }),
              attachments: [
                {
                  objectKey: expect.objectContaining({
                    redacted: true,
                    reason: 'sensitive-key',
                  }),
                },
              ],
            },
          },
          after: {
            status: 'submitted',
            payload: {
              responseText: expect.objectContaining({
                redacted: true,
                hash: expect.stringMatching(/^sha256:/),
              }),
              accessToken: expect.objectContaining({
                redacted: true,
                reason: 'sensitive-key',
              }),
            },
          },
          changes: {
            status: { from: 'draft', to: 'submitted' },
          },
          request: {
            ipAddress: '203.0.113.10',
            userAgent: 'Vitest',
            authorization: expect.objectContaining({
              redacted: true,
              reason: 'sensitive-key',
            }),
          },
        },
      },
      select: { id: true },
    })

    const auditPayload = JSON.stringify(prisma.auditLog.create.mock.calls)
    expect(auditPayload).not.toContain('private student essay')
    expect(auditPayload).not.toContain('private/submission-key.pdf')
    expect(auditPayload).not.toContain('secret-token')
    expect(auditPayload).not.toContain('Bearer secret')
  })

  it('redacts short feedback fields', async () => {
    prisma.auditLog.create.mockResolvedValueOnce({ id: 'audit-1' } as never)

    await writeAuditLog({
      actorId: '7f6c9f72-1e95-4f36-8f06-0f0a9ed0b1c2',
      action: 'grade.updated',
      entity: 'grade',
      entityId: 'grade-1',
      diff: {
        feedbackMd: 'Clear organization.',
      },
    })

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        diff: expect.objectContaining({
          changes: {
            feedbackMd: expect.objectContaining({
              redacted: true,
              hash: expect.stringMatching(/^sha256:/),
              length: 19,
            }),
          },
        }),
      }),
      select: { id: true },
    })
    expect(JSON.stringify(prisma.auditLog.create.mock.calls)).not.toContain(
      'Clear organization.',
    )
  })

  it('serializes Date values in audit diffs', async () => {
    prisma.auditLog.create.mockResolvedValueOnce({ id: 'audit-1' } as never)
    const archivedAt = new Date('2026-06-30T04:15:00.000Z')

    await writeAuditLog({
      actorId: '7f6c9f72-1e95-4f36-8f06-0f0a9ed0b1c2',
      action: 'course.archived',
      entity: 'course',
      entityId: 'course-1',
      before: {
        deletedAt: null,
      },
      after: {
        deletedAt: archivedAt,
      },
      diff: {
        deletedAt: { from: null, to: archivedAt },
      },
    })

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        diff: expect.objectContaining({
          before: { deletedAt: null },
          after: { deletedAt: archivedAt.toISOString() },
          changes: {
            deletedAt: {
              from: null,
              to: archivedAt.toISOString(),
            },
          },
        }),
      }),
      select: { id: true },
    })
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
        diff: { title: { from: 'Old', to: 'New' } },
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
