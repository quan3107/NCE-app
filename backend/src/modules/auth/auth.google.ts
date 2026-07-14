/**
 * File: src/modules/auth/auth.google.ts
 * Purpose: Orchestrate Google OAuth sign-in flows.
 * Why: Keeps controller-facing Google auth entry points compact and focused.
 */
import { prisma } from '../../config/prismaClient.js'
import { runWithRole } from '../../prisma/client.js'
import { googleAuthCallbackSchema } from './auth.schema.js'
import { createAuthError } from './auth.errors.js'
import { generateRefreshToken, timingSafeMatch } from './auth.crypto.js'
import { persistSession } from './auth.sessions.js'
import { assertUserIsActive, toAuthenticatedUser } from './auth.users.js'
import { signAccessToken } from './auth.tokens.js'
import {
  assertValidCodeVerifier,
  assertValidRedirectUri,
  buildGoogleAuthorizationUrl,
} from './auth.google.oauth.js'
import { fetchGoogleProfile } from './auth.google.profile.js'
import { findOrCreateGoogleIdentity } from './auth.google.identity.js'
import type { AuthSessionResult, SessionContext } from './auth.types.js'
import { writeAuthAuditLogSafely } from './auth.audit.js'

type CompleteGoogleAuthorizationOptions = {
  redirectUri: string
  expectedState: string | null
  codeVerifier: string | null
  context: SessionContext
}

export { buildGoogleAuthorizationUrl }

const requestMetadataFromContext = (context: SessionContext) => ({
  ipAddress: context.ipAddress ?? null,
  userAgent: context.userAgent ?? null,
})

export async function completeGoogleAuthorization(
  query: unknown,
  options: CompleteGoogleAuthorizationOptions,
): Promise<AuthSessionResult> {
  const { redirectUri, expectedState, codeVerifier, context } = options

  assertValidRedirectUri(redirectUri)

  const { code, state } = googleAuthCallbackSchema.parse(query)

  if (!expectedState || !timingSafeMatch(expectedState, state)) {
    throw createAuthError(
      400,
      'Google sign-in state is invalid or expired. Please try again.',
    )
  }

  assertValidCodeVerifier(codeVerifier)

  const profile = await fetchGoogleProfile({
    code,
    redirectUri,
    codeVerifier,
  })

  const refreshToken = generateRefreshToken()

  const { finalUser, session, identityId, emailVerifiedUpdated } = await runWithRole(
    { role: 'service_role', userRole: 'service_role' },
    async () => {
      const identityRecord = await findOrCreateGoogleIdentity(profile)

      const finalUser = identityRecord.user
      assertUserIsActive(finalUser)

      const emailVerifiedUpdated = profile.emailVerified && !identityRecord.emailVerified
      if (emailVerifiedUpdated) {
        await prisma.identity.update({
          where: { id: identityRecord.id },
          data: {
            emailVerified: true,
          },
        })
      }

      const session = await persistSession(finalUser.id, refreshToken, {
        ...context,
      })

      return {
        finalUser,
        session,
        identityId: identityRecord.id,
        emailVerifiedUpdated,
      }
    },
  )

  const accessToken = signAccessToken({
    userId: finalUser.id,
    role: finalUser.role,
    status: finalUser.status,
  })

  await writeAuthAuditLogSafely({
    actorId: finalUser.id,
    action: 'auth.google_login_succeeded',
    entity: 'auth_session',
    entityId: session.id,
    diff: {
      userId: finalUser.id,
      identityId,
      role: finalUser.role,
      status: finalUser.status,
      emailVerifiedUpdated,
    },
    requestMetadata: requestMetadataFromContext(context),
  })

  return {
    user: toAuthenticatedUser(finalUser),
    accessToken,
    refreshToken: session.refreshToken,
    refreshTokenExpiresAt: session.expiresAt,
  }
}
