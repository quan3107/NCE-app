/**
 * File: src/modules/auth/auth.google.link.ts
 * Purpose: Require browser-bound consent and password proof before linking Google.
 * Why: A matching email alone must never grant access to an existing account.
 */
import { randomBytes } from 'node:crypto'
import bcrypt from 'bcrypt'
import { z } from 'zod'
import { prisma } from '../../config/prismaClient.js'
import { runWithRole } from '../../prisma/client.js'
import { hashValue } from './auth.crypto.js'
import { createAuthError, isUniqueConstraintError } from './auth.errors.js'
import { authRateLimiter } from './auth.rate-limit.js'
import { lockSessionUser } from './auth.sessions.js'
import { assertActiveUser } from './auth.users.js'
import type { GoogleProfile } from './auth.google.profile.js'
import { GOOGLE_ALLOWED_ISSUERS, normalizeGoogleIssuer } from './auth.google.issuer.js'
import type { SessionContext } from './auth.types.js'

const serviceRole = { role: 'service_role', userRole: 'service_role' } as const
export const GOOGLE_LINK_COOKIE = 'googleLinkToken'
export const GOOGLE_LINK_TTL_MS = 5 * 60_000
export type GoogleLinkRequired = { status: 'link_required'; token: string }
const invalid = () =>
  createAuthError(
    400,
    'Account linking is invalid or expired. Start Google sign-in again.',
  )
const conflict = () =>
  createAuthError(409, 'Google account cannot be linked. Start Google sign-in again.')
const confirmSchema = z
  .object({
    challengeId: z.string().uuid(),
    consent: z.literal(true),
    password: z.string().min(1).max(1024),
  })
  .strict()

// Called only after Google's signed token and verified email have been checked.
// The caller owns the service-role transaction.
export async function createGoogleLinkChallenge(
  profile: GoogleProfile,
  userId: string,
): Promise<GoogleLinkRequired> {
  const issuer = normalizeGoogleIssuer(profile.providerIssuer)
  if (!issuer) throw createAuthError(401, 'Google issuer is not trusted.')
  await lockSessionUser(userId)
  const user = await prisma.user.findFirst({ where: { id: userId, deletedAt: null } })
  if (
    !user ||
    user.email.toLowerCase() !== profile.normalizedEmail ||
    !profile.emailVerified
  )
    throw conflict()
  assertActiveUser(user)
  const token = randomBytes(32).toString('hex')
  // Bound storage and invalidate earlier attempts for this account. Different
  // browsers cannot adopt each other's challenges, even for the same email.
  await prisma.googleLinkChallenge.deleteMany({
    where: { OR: [{ userId }, { expiresAt: { lte: new Date() } }] },
  })
  await prisma.googleLinkChallenge.create({
    data: {
      tokenHash: hashValue(token),
      userId,
      subject: profile.providerSubject,
      issuer,
      email: profile.normalizedEmail,
      passwordFingerprint: hashValue(user.password!),
      expiresAt: new Date(Date.now() + GOOGLE_LINK_TTL_MS),
    },
  })
  return { status: 'link_required', token }
}

function tokenHash(token: string | null): string {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) throw invalid()
  return hashValue(token)
}

export async function readGoogleLinkChallenge(token: string | null) {
  const hash = tokenHash(token)
  return runWithRole(serviceRole, async () => {
    const challenge = await prisma.googleLinkChallenge.findUnique({
      where: { tokenHash: hash },
      include: { user: true },
    })
    if (
      !challenge ||
      !normalizeGoogleIssuer(challenge.issuer) ||
      challenge.expiresAt.getTime() <= Date.now() ||
      challenge.user.deletedAt ||
      !challenge.user.password ||
      hashValue(challenge.user.password) !== challenge.passwordFingerprint ||
      challenge.user.email.toLowerCase() !== challenge.email.toLowerCase()
    )
      throw invalid()
    assertActiveUser(challenge.user)
    return {
      challengeId: challenge.id,
      email: challenge.email,
      expiresAt: challenge.expiresAt,
    }
  })
}

export async function cancelGoogleLink(
  token: string | null,
  payload: unknown,
): Promise<void> {
  const { challengeId } = z
    .object({ challengeId: z.string().uuid() })
    .strict()
    .parse(payload)
  const hash = tokenHash(token)
  await runWithRole(serviceRole, async () => {
    const candidate = await prisma.googleLinkChallenge.findUnique({
      where: { tokenHash: hash },
    })
    if (!candidate || candidate.id !== challengeId) throw invalid()
    await lockSessionUser(candidate.userId)
    const cancelled = await prisma.googleLinkChallenge.deleteMany({
      where: { id: challengeId, tokenHash: hash },
    })
    // If confirmation won the lock, cancellation must not claim it succeeded.
    if (cancelled.count !== 1) throw invalid()
  })
}

export async function confirmGoogleLink(
  token: string | null,
  payload: unknown,
  context: SessionContext,
): Promise<void> {
  const data = confirmSchema.parse(payload)
  const hash = tokenHash(token)
  const candidate = await runWithRole(serviceRole, () =>
    prisma.googleLinkChallenge.findUnique({
      where: { tokenHash: hash },
      include: { user: true },
    }),
  )
  if (
    !candidate ||
    !normalizeGoogleIssuer(candidate.issuer) ||
    candidate.id !== data.challengeId ||
    candidate.expiresAt.getTime() <= Date.now()
  )
    throw invalid()
  const attempt = { email: candidate.email, ipAddress: context.ipAddress }
  authRateLimiter.assertPasswordLoginAllowed(attempt)
  if (
    !candidate.user.password ||
    !(await bcrypt.compare(data.password, candidate.user.password))
  ) {
    authRateLimiter.recordPasswordLoginFailure(attempt)
    throw createAuthError(401, 'Incorrect password. Accounts have not been linked.')
  }
  try {
    await runWithRole(serviceRole, async () => {
      // Same lock as password reset/login prevents a checked password becoming
      // stale, and serializes cancel, confirm, and simultaneous linking attempts.
      await lockSessionUser(candidate.userId)
      const fresh = await prisma.googleLinkChallenge.findUnique({
        where: { tokenHash: hash },
        include: { user: true },
      })
      if (
        !fresh ||
        fresh.id !== data.challengeId ||
        fresh.expiresAt.getTime() <= Date.now() ||
        fresh.user.deletedAt ||
        fresh.user.password !== candidate.user.password ||
        hashValue(fresh.user.password!) !== fresh.passwordFingerprint ||
        fresh.user.email.toLowerCase() !== fresh.email.toLowerCase()
      )
        throw invalid()
      assertActiveUser(fresh.user)
      const issuer = normalizeGoogleIssuer(fresh.issuer)
      if (!issuer) throw invalid()
      // Include deleted identities: they cannot silently be resurrected/reassigned.
      const identities = await prisma.identity.findMany({
        where: {
          provider: 'google',
          OR: [
            { userId: fresh.userId },
            { providerSubject: fresh.subject },
            { providerIssuer: { in: [...GOOGLE_ALLOWED_ISSUERS] }, email: fresh.email },
          ],
        },
      })
      if (identities.length) throw conflict()
      await prisma.identity.create({
        data: {
          userId: fresh.userId,
          provider: 'google',
          providerSubject: fresh.subject,
          providerIssuer: issuer,
          email: fresh.email,
          emailVerified: true,
        },
      })
      await prisma.googleLinkChallenge.delete({ where: { id: fresh.id } })
      // Linking does not issue a session. A fresh Google/password login uses the
      // existing cookie coordinator and eliminates late link-response login races.
    })
  } catch (error) {
    if (isUniqueConstraintError(error)) throw conflict()
    throw error
  }
  authRateLimiter.recordPasswordLoginSuccess(attempt)
}
