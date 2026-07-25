/**
 * File: tests/modules/audit-logs/audit-logs.redaction-regressions.test.ts
 * Purpose: Cover audit redaction aliases, value detection, and safe boundaries.
 * Why: Immutable audit rows must never retain credentials, paths, or credential URLs.
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
const prisma = vi.mocked(prismaModule.prisma, true)
const { writeAuditLog } =
  await import('../../../src/modules/audit-logs/audit-logs.service.js')

const auditIdentity = {
  action: 'course.updated',
  entity: 'course',
  entityId: 'course-1',
}

const sensitiveMetadata = {
  credentials: 'username:password',
  code_verifier: 'oauth-code-verifier',
  path: 'private/course.json',
  uploadPath: 'private/upload.json',
  document_path: 'private/document.json',
  privatePem: 'private-pem',
  signed_uri: 'https://files.test/keyed-by-name',
  downloadLocation: 'https://files.test/course.json?X-Amz-Signature=private-signature',
  authenticatedLocation: 'https://private-user:private-pass@files.test/course.json',
  apiLocation: 'https://files.test/course.json?api_key=private-api-key',
  callbackLocation: 'https://app.test/callback#access_token=private-access-token',
}

const entryPoints = [
  { inputKey: 'before', outputKey: 'before' },
  { inputKey: 'after', outputKey: 'after' },
  { inputKey: 'diff', outputKey: 'changes' },
  { inputKey: 'requestMetadata', outputKey: 'request' },
] as const

const allowlistedNames = ['itemKey', 'pageKey', 'sectionKey', 'widgetKey']
const lookalikeCases = allowlistedNames.flatMap((name) => {
  const stem = name.slice(0, -3)
  return [
    { allowlistedName: name, lookalike: `${name[0]?.toUpperCase()}${name.slice(1)}` },
    { allowlistedName: name, lookalike: `${stem}_key` },
    { allowlistedName: name, lookalike: `${stem}-key` },
  ]
})

describe('audit log redaction regressions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prisma.auditLog.create.mockResolvedValue({ id: 'audit-1' } as never)
  })

  it.each(entryPoints)(
    'redacts aliases and credential URL values in $inputKey',
    async ({ inputKey, outputKey }) => {
      const input: Parameters<typeof writeAuditLog>[0] = { ...auditIdentity }
      input[inputKey] = sensitiveMetadata

      await writeAuditLog(input)

      const storedDiff = prisma.auditLog.create.mock.calls[0]?.[0].data.diff as
        | Record<string, unknown>
        | undefined
      const storedEntry = storedDiff?.[outputKey] as Record<string, unknown> | undefined

      for (const key of [
        'credentials',
        'code_verifier',
        'path',
        'uploadPath',
        'document_path',
        'privatePem',
        'signed_uri',
      ]) {
        expect(storedEntry?.[key]).toEqual({
          redacted: true,
          reason: 'sensitive-key',
        })
      }
      for (const key of [
        'downloadLocation',
        'authenticatedLocation',
        'apiLocation',
        'callbackLocation',
      ]) {
        expect(storedEntry?.[key]).toEqual({
          redacted: true,
          reason: 'sensitive-value',
        })
      }

      const storedJson = JSON.stringify(storedDiff)
      for (const privateValue of Object.values(sensitiveMetadata)) {
        expect(storedJson).not.toContain(privateValue)
      }
    },
  )

  it('omits hashes for sensitive containers with secret descendants', async () => {
    await writeAuditLog({
      ...auditIdentity,
      diff: {
        payload: {
          endpoint: 'https://files.test/result?api_key=guessable-api-key',
        },
        prompt: {
          uploadPath: 'private/prompt.json',
        },
        response: [
          {
            url: 'https://files.test/result?sig=guessable-signature',
          },
        ],
        submission: {
          password: '123456',
        },
        content: {
          nested: {
            accessToken: 'guessable-token',
          },
        },
      },
    })

    const storedDiff = prisma.auditLog.create.mock.calls[0]?.[0].data.diff as {
      changes: Record<string, unknown>
    }
    for (const key of ['payload', 'prompt', 'response', 'submission', 'content']) {
      expect(storedDiff.changes[key]).toEqual({
        redacted: true,
        reason: 'sensitive-value',
      })
    }

    const storedJson = JSON.stringify(storedDiff)
    for (const privateValue of [
      '123456',
      'guessable-token',
      'guessable-signature',
      'guessable-api-key',
      'private/prompt.json',
    ]) {
      expect(storedJson).not.toContain(privateValue)
    }
  })

  it('preserves 200-character values and redacts 201-character values', async () => {
    const boundaryValue = 'a'.repeat(200)
    const oversizedValue = 'b'.repeat(201)

    await writeAuditLog({
      ...auditIdentity,
      diff: {
        boundaryValue,
        oversizedValue,
      },
    })

    const storedDiff = prisma.auditLog.create.mock.calls[0]?.[0].data.diff as {
      changes: Record<string, unknown>
    }
    expect(storedDiff.changes.boundaryValue).toBe(boundaryValue)
    expect(storedDiff.changes.oversizedValue).toEqual({
      redacted: true,
      reason: 'sensitive-value',
      hash: expect.stringMatching(/^sha256:/),
      length: 201,
    })
  })

  it('preserves HTTP URLs without credential-bearing components', async () => {
    const publicLocation = 'https://files.test/course.json?page=2#overview'

    await writeAuditLog({
      ...auditIdentity,
      diff: { publicLocation },
    })

    const storedDiff = prisma.auditLog.create.mock.calls[0]?.[0].data.diff as {
      changes: Record<string, unknown>
    }
    expect(storedDiff.changes.publicLocation).toBe(publicLocation)
  })

  it.each(lookalikeCases)(
    'redacts $lookalike without broadening the $allowlistedName allowlist',
    async ({ lookalike }) => {
      const privateValue = `private-${lookalike}`

      await writeAuditLog({
        ...auditIdentity,
        diff: {
          [lookalike]: privateValue,
        },
      })

      const storedDiff = prisma.auditLog.create.mock.calls[0]?.[0].data.diff as {
        changes: Record<string, unknown>
      }
      expect(storedDiff.changes[lookalike]).toEqual({
        redacted: true,
        reason: 'sensitive-key',
      })
      expect(JSON.stringify(storedDiff)).not.toContain(privateValue)
    },
  )
})
