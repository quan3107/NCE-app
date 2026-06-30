/**
 * File: src/modules/auth/auth.refresh.ts
 * Purpose: Refresh and revoke auth sessions using refresh tokens.
 * Why: Centralizes refresh/logout flow handling outside password and OAuth modules.
 */
import { prisma } from '../../config/prismaClient.js'
import { runWithRole } from '../../prisma/client.js'
import { refreshSessionSchema } from './auth.schema.js'
import { createAuthError } from './auth.errors.js'
import { generateRefreshToken, hashValue } from './auth.crypto.js'
import {
  RefreshSessionClaimError,
  revokeSessionFamily,
  rotateSession,
} from './auth.sessions.js'
import { assertActiveUser, toAuthenticatedUser } from './auth.users.js'
import { signAccessToken } from './auth.tokens.js'
import type { AuthSessionResult, SessionContext } from './auth.types.js'
import { writeAuditLogSafely } from '../audit-logs/audit-logs.service.js'

const invalidRefreshTokenError = () =>
  createAuthError(401, 'Refresh token is invalid or expired.')

const requestMetadataFromContext = (context: SessionContext) => ({
  ipAddress: context.ipAddress ?? null,
  userAgent: context.userAgent ?? null,
})

export async function handleSessionRefresh(
  payload: unknown,
  context: SessionContext,
): Promise<AuthSessionResult> {
  const parsed = refreshSessionSchema.safeParse(payload)
  const refreshToken =
    typeof context.refreshToken === 'string' && context.refreshToken.length > 0
      ? context.refreshToken
      : parsed.success
        ? parsed.data.refreshToken
        : null

  if (!refreshToken) {
    throw createAuthError(401, 'Refresh token is missing.')
  }

  const now = new Date()
  const refreshTokenHash = hashValue(refreshToken)
  const nextRefreshToken = generateRefreshToken()

  const { rotated, user } = await runWithRole(
    { role: 'service_role', userRole: 'service_role' },
    async () => {
      const session = await prisma.authSession.findFirst({
        where: {
          refreshTokenHash,
          revokedAt: null,
          replacedAt: null,
          expiresAt: {
            gt: now,
          },
        },
        select: {
          id: true,
          userId: true,
          familyId: true,
        },
      })

      if (!session) {
        const reusedSession = await prisma.authSession.findFirst({
          where: {
            refreshTokenHash,
            OR: [
              {
                replacedAt: {
                  not: null,
                },
              },
              {
                revokedAt: {
                  not: null,
                },
              },
            ],
          },
          select: {
            familyId: true,
          },
        })

        if (reusedSession) {
          await revokeSessionFamily(reusedSession.familyId, now)
        }

        throw invalidRefreshTokenError()
      }

      const user = await prisma.user.findFirst({
        where: { id: session.userId, deletedAt: null },
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          status: true,
          password: true,
        },
      })

      if (!user) {
        await prisma.authSession.update({
          where: { id: session.id },
          data: {
            revokedAt: now,
          },
        })
        throw createAuthError(401, 'Account is no longer available.')
      }

      assertActiveUser(user, { requirePassword: false })

      let rotated
      try {
        rotated = await rotateSession(session, nextRefreshToken, context)
      } catch (error) {
        if (error instanceof RefreshSessionClaimError) {
          await revokeSessionFamily(error.familyId, error.detectedAt)
          throw invalidRefreshTokenError()
        }
        throw error
      }

      return { rotated, user }
    },
  )

  const accessToken = signAccessToken({
    userId: user.id,
    role: user.role,
    status: user.status,
  })

  await writeAuditLogSafely({
    actorId: user.id,
    action: 'auth.session_refreshed',
    entity: 'auth_session',
    entityId: rotated.id,
    diff: {
      previousSessionId: rotated.rotatedFromId,
      familyId: rotated.familyId,
    },
    requestMetadata: requestMetadataFromContext(context),
  })

  return {
    user: toAuthenticatedUser(user),
    accessToken,
    refreshToken: rotated.refreshToken,
    refreshTokenExpiresAt: rotated.expiresAt,
  }
}

export async function handleLogout(
  payload: unknown,
  context: SessionContext,
): Promise<void> {
  const parsed = refreshSessionSchema.safeParse(payload)
  const refreshToken =
    typeof context.refreshToken === 'string' && context.refreshToken.length > 0
      ? context.refreshToken
      : parsed.success
        ? parsed.data.refreshToken
        : null

  if (!refreshToken) {
    return
  }

  const refreshTokenHash = hashValue(refreshToken)

  const revokedSession = await runWithRole(
    { role: 'service_role', userRole: 'service_role' },
    async () => {
      const session = await prisma.authSession.findFirst({
        where: {
          refreshTokenHash,
          revokedAt: null,
        },
        select: {
          id: true,
          userId: true,
          familyId: true,
        },
      })

      if (!session) {
        return null
      }

      const revokeResult = await prisma.authSession.updateMany({
        where: {
          refreshTokenHash,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      })

      if (revokeResult.count !== 1) {
        return null
      }

      return session
    },
  )

  if (!revokedSession) {
    return
  }

  await writeAuditLogSafely({
    actorId: revokedSession.userId,
    action: 'auth.session_revoked',
    entity: 'auth_session',
    entityId: revokedSession.id,
    diff: {
      familyId: revokedSession.familyId,
    },
    requestMetadata: requestMetadataFromContext(context),
  })
}
