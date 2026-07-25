/**
 * File: tests/modules/audit-logs/audit-logs.query.test.ts
 * Purpose: Verify admin audit filtering and pagination queries.
 * Why: Query behavior stays focused while sanitizer regressions remain readable.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../src/prisma/client.js', () => ({
  prisma: {
    auditLog: {
      findMany: vi.fn(),
    },
  },
}))

const prismaModule = await import('../../../src/prisma/client.js')
const prisma = vi.mocked(prismaModule.prisma, true)
const { listAuditLogs } =
  await import('../../../src/modules/audit-logs/audit-logs.service.js')

describe('audit log query service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
