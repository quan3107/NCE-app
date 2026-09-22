/**
 * File: src/modules/auth/auth.google.identity.ts
 * Purpose: Resolve Google identities without trusting email as account ownership.
 * Why: Existing password accounts require explicit password-verified linking.
 */
import { prisma } from '../../config/prismaClient.js'
import { normalizedDisplayNameSchema } from '../../utils/displayNameValidation.js'
import { createAuthError, isUniqueConstraintError } from './auth.errors.js'
import { assertUserIsActive, type ActiveUserRecord } from './auth.users.js'
import { createGoogleLinkChallenge, type GoogleLinkRequired } from './auth.google.link.js'
import type { GoogleProfile } from './auth.google.profile.js'
import { normalizeGoogleIssuer } from './auth.google.issuer.js'

type IdentityWithUser = { id: string; emailVerified: boolean; user: ActiveUserRecord }
const selectUserFields = {
  id: true,
  email: true,
  fullName: true,
  role: true,
  status: true,
} as const

export async function findOrCreateGoogleIdentity(
  profile: GoogleProfile,
): Promise<IdentityWithUser | GoogleLinkRequired> {
  if (!profile.emailVerified) throw createAuthError(401, 'Google email must be verified.')
  const { providerSubject, normalizedEmail, fullName } = profile
  const providerIssuer = normalizeGoogleIssuer(profile.providerIssuer)
  if (!providerIssuer) throw createAuthError(401, 'Google issuer is not trusted.')
  const existingIdentity = await prisma.identity.findFirst({
    where: { provider: 'google', providerSubject },
    include: { user: true },
  })
  if (existingIdentity) {
    if (
      existingIdentity.deletedAt ||
      existingIdentity.user.deletedAt ||
      normalizeGoogleIssuer(existingIdentity.providerIssuer) !== providerIssuer
    ) {
      throw createAuthError(
        409,
        'Google identity is unavailable or conflicts with an existing identity.',
      )
    }
    assertUserIsActive(existingIdentity.user)
    return existingIdentity
  }
  const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } })
  if (existingUser) {
    if (existingUser.deletedAt)
      throw createAuthError(403, 'Account is not active. Contact support for assistance.')
    assertUserIsActive(existingUser)
    return createGoogleLinkChallenge(profile, existingUser.id)
  }
  const parsedName = normalizedDisplayNameSchema.safeParse(fullName)
  if (!parsedName.success)
    throw createAuthError(
      400,
      'Google account name does not meet display-name requirements. Update your Google profile and try again.',
    )
  try {
    return await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: normalizedEmail,
          fullName: parsedName.data,
          password: null,
          role: 'student',
          status: 'active',
        },
        select: selectUserFields,
      })
      const identity = await tx.identity.create({
        data: {
          userId: user.id,
          provider: 'google',
          providerSubject,
          providerIssuer,
          email: normalizedEmail,
          emailVerified: true,
        },
        select: { id: true, emailVerified: true },
      })
      return { ...identity, user }
    })
  } catch (error) {
    // Never auto-link in race recovery; a new attempt resolves the committed owner.
    if (isUniqueConstraintError(error))
      throw createAuthError(
        409,
        'Account changed during Google sign-in. Please try again.',
      )
    throw error
  }
}
