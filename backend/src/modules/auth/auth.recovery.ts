/**
 * File: src/modules/auth/auth.recovery.ts
 * Purpose: Issue single-use password recovery links and atomically revoke sessions.
 * Why: Recover only active password accounts without disclosing account existence.
 */
import { randomBytes } from 'node:crypto'
import bcrypt from 'bcrypt'
import { config } from '../../config/env.js'
import { logger } from '../../config/logger.js'
import { prisma } from '../../config/prismaClient.js'
import { runWithRole } from '../../prisma/client.js'
import { sendNotificationEmail } from '../../utils/emailClient.js'
import { hashValue } from './auth.crypto.js'
import { createAuthError } from './auth.errors.js'
import { requestPasswordResetSchema, resetPasswordSchema } from './auth.schema.js'
import { lockSessionUser } from './auth.sessions.js'

export const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000
export const PASSWORD_RESET_REQUEST_MESSAGE =
  'If an eligible account exists for that email, a password reset link will be sent. Check your inbox and spam folder.'
const invalidLink = () =>
  createAuthError(
    400,
    'This password reset link is invalid or expired. Request a new link.',
  )
const serviceRole = { role: 'service_role', userRole: 'service_role' } as const

export async function requestPasswordReset(payload: unknown): Promise<void> {
  const { email } = requestPasswordResetSchema.parse(payload)
  // Validate deployment configuration before looking at the account so a bad
  // origin cannot make existing and unknown email responses diverge.
  const origin = config.cors.allowedOrigins[0]
  if (!origin || (config.nodeEnv === 'production' && !origin.startsWith('https://'))) {
    throw createAuthError(503, 'Password recovery is temporarily unavailable.')
  }
  const link = new URL('/reset-password', origin)
  const token = randomBytes(32).toString('hex')
  const tokenHash = hashValue(token)
  const now = Date.now()
  const issued = await runWithRole(serviceRole, async () => {
    // A database-backed cooldown also limits one recipient across IPs/processes.
    // Ineligible and cooldown requests have exactly the same public response.
    return prisma.user.updateMany({
      where: {
        email,
        deletedAt: null,
        status: 'active',
        password: { not: null },
        OR: [
          { passwordResetExpiresAt: null },
          {
            passwordResetExpiresAt: {
              lte: new Date(now + PASSWORD_RESET_TTL_MS - 60_000),
            },
          },
        ],
      },
      data: {
        passwordResetHash: tokenHash,
        passwordResetExpiresAt: new Date(now + PASSWORD_RESET_TTL_MS),
      },
    })
  })
  if (issued.count !== 1) return

  // Never use the untrusted request Host/Origin to construct a credential link.
  // A fragment keeps the token out of HTTP access logs and Referer headers.
  link.hash = new URLSearchParams({ token }).toString()
  // Provider latency and failures must not reveal whether an account exists.
  // Delivery is best-effort: users can request another link after the cooldown.
  void sendNotificationEmail({
    to: email,
    subject: 'Reset your NCE password',
    bodyText: `Open this link to reset your password:\n${link.toString()}\n\nThis link expires in 30 minutes and can be used once. Resetting your password signs out all existing sessions. If you did not request this, you can ignore this email.`,
  }).catch(async () => {
    logger.error('Password recovery email delivery failed')
    try {
      await runWithRole(serviceRole, () =>
        prisma.user.updateMany({
          where: { passwordResetHash: tokenHash },
          data: { passwordResetHash: null, passwordResetExpiresAt: null },
        }),
      )
    } catch {
      logger.error('Unable to invalidate undelivered password recovery link')
    }
  })
}

export async function resetPassword(payload: unknown): Promise<void> {
  const parsed = resetPasswordSchema.safeParse(payload)
  if (!parsed.success) {
    // Keep malformed tokens indistinguishable from unknown/used/expired tokens.
    if (
      !resetPasswordSchema.shape.token.safeParse(
        (payload as { token?: unknown } | null)?.token,
      ).success
    )
      throw invalidLink()
    throw parsed.error
  }
  const tokenHash = hashValue(parsed.data.token)
  // Hash outside the transaction; expiry is checked again after acquiring the lock.
  const password = await bcrypt.hash(parsed.data.password, 12)
  await runWithRole(serviceRole, async () => {
    const candidate = await prisma.user.findFirst({
      where: { passwordResetHash: tokenHash },
      select: { id: true },
    })
    if (!candidate) throw invalidLink()
    await lockSessionUser(candidate.id)
    const now = new Date()
    const changed = await prisma.user.updateMany({
      where: {
        id: candidate.id,
        passwordResetHash: tokenHash,
        passwordResetExpiresAt: { gt: now },
        deletedAt: null,
        status: 'active',
        password: { not: null },
      },
      data: { password, passwordResetHash: null, passwordResetExpiresAt: null },
    })
    if (changed.count !== 1) throw invalidLink()
    // The role context is one transaction: password, token consumption, and all
    // refresh families commit together. Bearer authorization checks these rows.
    await prisma.authSession.updateMany({
      where: { userId: candidate.id, revokedAt: null },
      data: { revokedAt: now },
    })
  })
}
