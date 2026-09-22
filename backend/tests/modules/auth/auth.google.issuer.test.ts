/**
 * File: tests/modules/auth/auth.google.issuer.test.ts
 * Purpose: Keep trusted Google issuer aliases compatible with existing identities.
 * Why: Synthetic profiles cover both directions without claiming live provider output.
 */
import { beforeEach, expect, it, vi } from 'vitest'
import {
  buildIdentity,
  prisma,
  resetAuthServiceMocks,
} from './auth.service.test-utils.js'
import { findOrCreateGoogleIdentity } from '../../../src/modules/auth/auth.google.identity.js'

const canonical = 'https://accounts.google.com'
const legacy = 'accounts.google.com'
const profile = {
  providerSubject: 'google-subject',
  providerIssuer: canonical,
  normalizedEmail: 'issuer@example.invalid',
  emailVerified: true,
  fullName: 'Issuer Test',
}
beforeEach(() => {
  vi.clearAllMocks()
  resetAuthServiceMocks()
})

it.each([
  [canonical, legacy],
  [legacy, canonical],
])(
  'resolves stored issuer %s with incoming issuer %s to its original owner',
  async (stored, incoming) => {
    const identity = buildIdentity({ providerIssuer: stored })
    prisma.identity.findFirst.mockResolvedValueOnce(identity)
    await expect(
      findOrCreateGoogleIdentity({ ...profile, providerIssuer: incoming }),
    ).resolves.toEqual(identity)
    expect(prisma.identity.findFirst).toHaveBeenCalledWith({
      where: { provider: 'google', providerSubject: profile.providerSubject },
      include: { user: true },
    })
    expect(prisma.user.findUnique).not.toHaveBeenCalled()
    expect(prisma.identity.create).not.toHaveBeenCalled()
  },
)

it.each([
  'http://accounts.google.com',
  'https://accounts.google.com/',
  'https://accounts.google.com.evil.test',
  'ACCOUNTS.GOOGLE.COM',
  'untrusted-issuer',
])(
  'rejects untrusted incoming issuer %s before resolving an owner',
  async (providerIssuer) => {
    await expect(
      findOrCreateGoogleIdentity({ ...profile, providerIssuer }),
    ).rejects.toMatchObject({ statusCode: 401 })
    expect(prisma.identity.findFirst).not.toHaveBeenCalled()
  },
)

it('rejects an untrusted stored issuer for a trusted same-subject profile', async () => {
  prisma.identity.findFirst.mockResolvedValueOnce(
    buildIdentity({ providerIssuer: 'untrusted-issuer' }),
  )
  await expect(findOrCreateGoogleIdentity(profile)).rejects.toMatchObject({
    statusCode: 409,
  })
  expect(prisma.identity.create).not.toHaveBeenCalled()
})
