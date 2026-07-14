/**
 * File: src/modules/auth/auth.password.ts
 * Purpose: Handle password login and account registration flows.
 * Why: Keeps password-based auth logic focused and testable.
 */
import { UserRole, UserStatus } from "../../prisma/index.js"
import bcrypt from 'bcrypt'

import { prisma } from '../../config/prismaClient.js'
import { runWithRole } from '../../prisma/client.js'
import { passwordLoginSchema, registerAccountSchema } from './auth.schema.js'
import { signAccessToken } from './auth.tokens.js'
import { AUTH_ERROR, createAuthError, isUniqueConstraintError } from './auth.errors.js'
import { generateRefreshToken } from './auth.crypto.js'
import { authRateLimiter } from './auth.rate-limit.js'
import { persistSession } from './auth.sessions.js'
import { writeAuthAuditLogSafely } from './auth.audit.js'
import {
  assertActiveUser,
  assertUserIsActive,
  toAuthenticatedUser,
} from './auth.users.js'
import type {
  AuthSessionResult,
  RegisterAccountResult,
  SessionContext,
} from './auth.types.js'

const PASSWORD_SALT_ROUNDS = 12

const requestMetadataFromContext = (context: SessionContext) => ({
  ipAddress: context.ipAddress ?? null,
  userAgent: context.userAgent ?? null,
})

function getInitialRegistrationStatus(role: UserRole): UserStatus {
  return role === UserRole.teacher ? UserStatus.pending : UserStatus.active
}

export async function handlePasswordLogin(
  payload: unknown,
  context: SessionContext,
): Promise<AuthSessionResult> {
  const { email: rawEmail, password } = passwordLoginSchema.parse(payload)
  const email = rawEmail.trim().toLowerCase()
  const loginAttempt = { email, ipAddress: context.ipAddress }

  authRateLimiter.assertPasswordLoginAllowed(loginAttempt)

  const candidate = await runWithRole(
    { role: 'service_role', userRole: 'service_role' },
    async () =>
      prisma.user.findFirst({
        where: {
          email,
          deletedAt: null,
        },
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          status: true,
          password: true,
        },
      }),
  )

  if (!candidate) {
    authRateLimiter.recordPasswordLoginFailure(loginAttempt)
    throw createAuthError(401, AUTH_ERROR)
  }

  try {
    assertActiveUser(candidate)
  } catch (error) {
    authRateLimiter.recordPasswordLoginFailure(loginAttempt)
    throw error
  }

  const passwordValid = await bcrypt.compare(password, candidate.password!)

  if (!passwordValid) {
    authRateLimiter.recordPasswordLoginFailure(loginAttempt)
    throw createAuthError(401, AUTH_ERROR)
  }

  const refreshToken = generateRefreshToken()

  const { session, user } = await runWithRole(
    { role: 'service_role', userRole: 'service_role' },
    async () => {
      const freshUser = await prisma.user.findFirst({
        where: {
          id: candidate.id,
          deletedAt: null,
        },
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          status: true,
        },
      })

      if (!freshUser) {
        throw createAuthError(401, AUTH_ERROR)
      }

      assertUserIsActive(freshUser)

      const session = await persistSession(freshUser.id, refreshToken, context)

      return { session, user: freshUser }
    },
  )

  const accessToken = signAccessToken({
    userId: user.id,
    role: user.role,
    status: user.status,
  })

  authRateLimiter.recordPasswordLoginSuccess(loginAttempt)

  await writeAuthAuditLogSafely({
    actorId: user.id,
    action: 'auth.login_succeeded',
    entity: 'auth_session',
    entityId: session.id,
    diff: {
      userId: user.id,
      role: user.role,
      status: user.status,
    },
    requestMetadata: requestMetadataFromContext(context),
  })

  return {
    user: toAuthenticatedUser(user),
    accessToken,
    refreshToken: session.refreshToken,
    refreshTokenExpiresAt: session.expiresAt,
  }
}

export async function handleRegisterAccount(
  payload: unknown,
  context: SessionContext,
): Promise<RegisterAccountResult> {
  const parsed = registerAccountSchema.parse(payload)
  const passwordHash = await bcrypt.hash(parsed.password, PASSWORD_SALT_ROUNDS)
  const initialStatus = getInitialRegistrationStatus(parsed.role)

  const { session, userRecord } = await runWithRole(
    { role: 'service_role', userRole: 'service_role' },
    async () => {
      const existing = await prisma.user.findFirst({
        where: {
          email: parsed.email,
          deletedAt: null,
        },
        select: {
          id: true,
        },
      })

      if (existing) {
        throw createAuthError(409, 'An account with that email already exists.')
      }

      try {
        const userRecord = await prisma.user.create({
          data: {
            email: parsed.email,
            fullName: parsed.fullName,
            password: passwordHash,
            role: parsed.role,
            status: initialStatus,
          },
          select: {
            id: true,
            email: true,
            fullName: true,
            role: true,
            status: true,
          },
        })

        if (initialStatus !== UserStatus.active) {
          return { session: null, userRecord }
        }

        const refreshToken = generateRefreshToken()
        const session = await persistSession(userRecord.id, refreshToken, context)

        return { session, userRecord }
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          throw createAuthError(409, 'An account with that email already exists.')
        }
        throw error
      }
    },
  )

  if (userRecord.status === UserStatus.pending) {
    await writeAuthAuditLogSafely({
      actorId: userRecord.id,
      action: 'auth.registered',
      entity: 'user',
      entityId: userRecord.id,
      diff: {
        role: { to: userRecord.role },
        status: { to: userRecord.status },
      },
      requestMetadata: requestMetadataFromContext(context),
    })

    return {
      status: 'pending_approval',
      user: {
        ...toAuthenticatedUser(userRecord),
        status: userRecord.status,
      },
    }
  }

  if (!session) {
    throw createAuthError(500, 'Unable to create account session.')
  }

  const accessToken = signAccessToken({
    userId: userRecord.id,
    role: userRecord.role,
    status: userRecord.status,
  })

  await writeAuthAuditLogSafely({
    actorId: userRecord.id,
    action: 'auth.registered',
    entity: 'user',
    entityId: userRecord.id,
    diff: {
      role: { to: userRecord.role },
      status: { to: userRecord.status },
    },
    requestMetadata: requestMetadataFromContext(context),
  })

  return {
    user: toAuthenticatedUser(userRecord),
    accessToken,
    refreshToken: session.refreshToken,
    refreshTokenExpiresAt: session.expiresAt,
  }
}
