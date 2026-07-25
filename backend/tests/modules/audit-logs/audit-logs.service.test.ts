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

const { writeAuditLog, writeAuditLogSafely } =
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
          notes: 'Private draft notes.',
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
              redacted: true,
              reason: 'sensitive-value',
            },
          },
          after: {
            status: 'submitted',
            payload: {
              redacted: true,
              reason: 'sensitive-value',
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
    expect(auditPayload).not.toContain('Private draft notes.')
    expect(auditPayload).not.toContain('private/submission-key.pdf')
    expect(auditPayload).not.toContain('private student essay with more text')
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

  it('preserves allowlisted operational keys in nested metadata and arrays', async () => {
    prisma.auditLog.create.mockResolvedValueOnce({ id: 'audit-1' } as never)

    await writeAuditLog({
      action: 'cms.layout_updated',
      entity: 'cms_page_content',
      entityId: 'page-1',
      diff: {
        pageKey: 'homepage',
        answerKey: { correct: 'private-answer' },
        audioKey: 'private-audio',
        clientKey: 'private-client',
        privateKeyPem: 'private-pem',
        filePaths: ['private/one.pdf'],
        signedDownloadUrl: 'https://files.test/item?signature=private',
        prompt: { value: 'private prompt' },
        layout: {
          sectionKey: 'stats',
          items: [
            { itemKey: 'students', widgetKey: 'student-count' },
            { itemKey: 'courses', pageObjectKey: 'private/courses.json' },
          ],
        },
      },
    })

    const storedDiff = prisma.auditLog.create.mock.calls[0]?.[0].data.diff as {
      changes: Record<string, unknown>
    }
    expect(storedDiff.changes).toMatchObject({
      pageKey: 'homepage',
      layout: {
        sectionKey: 'stats',
        items: [
          { itemKey: 'students', widgetKey: 'student-count' },
          {
            itemKey: 'courses',
            pageObjectKey: { redacted: true, reason: 'sensitive-key' },
          },
        ],
      },
    })
    for (const key of [
      'answerKey',
      'audioKey',
      'clientKey',
      'privateKeyPem',
      'filePaths',
      'signedDownloadUrl',
    ]) {
      expect(storedDiff.changes[key]).toEqual({
        redacted: true,
        reason: 'sensitive-key',
      })
    }
    expect(storedDiff.changes.prompt).toEqual(
      expect.objectContaining({ redacted: true, reason: 'sensitive-value' }),
    )
    const auditPayload = JSON.stringify(prisma.auditLog.create.mock.calls)
    for (const privateValue of [
      'private-answer',
      'private-audio',
      'private-client',
      'private-pem',
      'private/one.pdf',
      'signature=private',
      'private prompt',
    ]) {
      expect(auditPayload).not.toContain(privateValue)
    }
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
})
