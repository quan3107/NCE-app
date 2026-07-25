/**
 * File: tests/modules/audit-logs/audit-logs.credential-families.test.ts
 * Purpose: Verify position-independent credential keys and authorization values.
 * Why: Arbitrary metadata representations must not bypass immutable audit redaction.
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

const sensitiveKeyMetadata = {
  currentSessionId: 'fixture-current-session',
  userSession: 'fixture-user-session',
  accessJwt: 'fixture-access-jwt',
  userBearer: 'fixture-user-bearer',
  authContext: 'fixture-auth-context',
  authenticationContext: 'fixture-authentication-context',
  authState: 'fixture-auth-state',
  authenticationState: 'fixture-authentication-state',
  authMetadata: 'fixture-auth-metadata',
}

const authorizationExamples = [
  ['Bearer', 'secret'],
  ['Token', 'secret'],
  ['ApiKey', 'secret'],
  ['JWT', 'secret'],
  ['AWS4-HMAC-SHA256', 'credential'],
  ['DPoP', 'proof'],
  ['Hawk', 'credential'],
  ['MAC', 'credential'],
] as const
const authorizationMetadata = Object.fromEntries(
  authorizationExamples.map(([scheme, credential], index) => [
    `transport${index}`,
    [scheme, credential].join(' '),
  ]),
)

const entryPoints = [
  { inputKey: 'before', outputKey: 'before' },
  { inputKey: 'after', outputKey: 'after' },
  { inputKey: 'diff', outputKey: 'changes' },
  { inputKey: 'requestMetadata', outputKey: 'request' },
] as const

describe('audit log credential families', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prisma.auditLog.create.mockResolvedValue({ id: 'audit-1' } as never)
  })

  it.each(entryPoints)(
    'redacts position-independent credential forms in $inputKey',
    async ({ inputKey, outputKey }) => {
      const input: Parameters<typeof writeAuditLog>[0] = { ...auditIdentity }
      input[inputKey] = {
        ...sensitiveKeyMetadata,
        ...authorizationMetadata,
        context: 'public-course-context',
        authorId: 'public-author',
        authorityLevel: 'editor',
        summary: 'Clear organization.',
        roomLabel: 'Room 101',
        lessonLabel: 'Lesson phase-1',
        versionLabel: 'Version v2',
        authenticityScore: 0.95,
        authenticMaterial: 'verified source',
      }

      await writeAuditLog(input)

      const storedDiff = prisma.auditLog.create.mock.calls[0]?.[0].data.diff as
        | Record<string, unknown>
        | undefined
      const storedEntry = storedDiff?.[outputKey] as Record<string, unknown> | undefined

      for (const key of Object.keys(sensitiveKeyMetadata)) {
        expect(storedEntry?.[key]).toEqual({
          redacted: true,
          reason: 'sensitive-key',
        })
      }
      for (const key of Object.keys(authorizationMetadata)) {
        expect(storedEntry?.[key]).toEqual({
          redacted: true,
          reason: 'sensitive-value',
        })
      }
      expect(storedEntry?.context).toBe('public-course-context')
      expect(storedEntry?.authorId).toBe('public-author')
      expect(storedEntry?.authorityLevel).toBe('editor')
      expect(storedEntry?.summary).toBe('Clear organization.')
      expect(storedEntry?.roomLabel).toBe('Room 101')
      expect(storedEntry?.lessonLabel).toBe('Lesson phase-1')
      expect(storedEntry?.versionLabel).toBe('Version v2')
      expect(storedEntry?.authenticityScore).toBe(0.95)
      expect(storedEntry?.authenticMaterial).toBe('verified source')

      const storedJson = JSON.stringify(storedDiff)
      for (const privateValue of [
        ...Object.values(sensitiveKeyMetadata),
        ...Object.values(authorizationMetadata),
      ]) {
        expect(storedJson).not.toContain(privateValue)
      }
    },
  )

  it('omits hashes for containers with equivalent credential descendants', async () => {
    const bearerValue = ['Bearer', 'secret'].join(' ')
    const tokenValue = ['Token', 'secret'].join(' ')
    const dpopValue = ['DPoP', 'proof'].join(' ')

    await writeAuditLog({
      ...auditIdentity,
      diff: {
        payload: {
          currentSessionId: 'fixture-nested-session',
        },
        requestPayload: {
          transport: tokenValue,
        },
        headerPayload: {
          transport: bearerValue,
        },
        contextPayload: {
          authContext: 'fixture-nested-auth-context',
        },
        statePayload: {
          authState: 'fixture-nested-auth-state',
        },
        proofPayload: {
          transport: dpopValue,
        },
      },
    })

    const storedDiff = prisma.auditLog.create.mock.calls[0]?.[0].data.diff as {
      changes: Record<string, unknown>
    }
    for (const key of [
      'payload',
      'requestPayload',
      'headerPayload',
      'contextPayload',
      'statePayload',
      'proofPayload',
    ]) {
      expect(storedDiff.changes[key]).toEqual({
        redacted: true,
        reason: 'sensitive-value',
      })
    }

    const storedJson = JSON.stringify(storedDiff)
    for (const privateValue of [
      'fixture-nested-session',
      'fixture-nested-auth-context',
      'fixture-nested-auth-state',
      bearerValue,
      tokenValue,
      dpopValue,
    ]) {
      expect(storedJson).not.toContain(privateValue)
    }
  })

  it('redacts lowercase compact private-content keys', async () => {
    const privateContent = {
      responsetext: 'private response',
      feedbackmd: 'private feedback',
      payloadjson: 'private payload',
      promptbody: 'private prompt',
      submissioncontent: 'private submission',
    }

    await writeAuditLog({
      ...auditIdentity,
      diff: privateContent,
    })

    const storedDiff = prisma.auditLog.create.mock.calls[0]?.[0].data.diff as {
      changes: Record<string, unknown>
    }
    for (const key of Object.keys(privateContent)) {
      expect(storedDiff.changes[key]).toEqual(
        expect.objectContaining({
          redacted: true,
          reason: 'sensitive-value',
          hash: expect.stringMatching(/^sha256:/),
        }),
      )
    }

    const storedJson = JSON.stringify(storedDiff)
    for (const privateValue of Object.values(privateContent)) {
      expect(storedJson).not.toContain(privateValue)
    }
  })
})
