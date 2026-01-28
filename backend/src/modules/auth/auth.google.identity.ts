/**
 * File: src/modules/auth/auth.google.identity.ts
 * Purpose: Link Google identities to existing or new users.
 * Why: Keeps identity persistence logic isolated from OAuth networking concerns.
 */
import { IdentityProvider, UserRole, UserStatus } from "../../prisma/generated/client/client.js";

import { prisma } from "../../config/prismaClient.js";
import { createAuthError, isUniqueConstraintError } from "./auth.errors.js";
import { assertUserIsActive, type ActiveUserRecord } from "./auth.users.js";
import type { GoogleProfile } from "./auth.google.profile.js";

type IdentityWithUser = {
  id: string;
  emailVerified: boolean;
  user: ActiveUserRecord;
};

const selectUserFields = {
  id: true,
  email: true,
  fullName: true,
  role: true,
  status: true,
} as const;

export async function findOrCreateGoogleIdentity(
  profile: GoogleProfile,
): Promise<IdentityWithUser> {
  const {
    providerSubject,
    providerIssuer,
    normalizedEmail,
    emailVerified,
    fullName,
  } = profile;

  // Reuse the same lookup whenever we need to recover from race conditions during identity creation.
  const findIdentityWithUser = async (): Promise<IdentityWithUser | null> =>
    prisma.identity.findFirst({
      where: {
        provider: IdentityProvider.google,
        providerSubject,
        deletedAt: null,
        user: {
          deletedAt: null,
        },
      },
      select: {
        id: true,
        emailVerified: true,
        user: {
          select: selectUserFields,
        },
      },
    });

  let identityRecord = await findIdentityWithUser();

  if (!identityRecord) {
    // Attach Google to an existing account when the email is already registered locally.
    const existingUser = await prisma.user.findFirst({
      where: {
        email: normalizedEmail,
        deletedAt: null,
      },
      select: selectUserFields,
    });

    if (existingUser) {
      assertUserIsActive(existingUser);
      try {
        const createdIdentity = await prisma.identity.create({
          data: {
            userId: existingUser.id,
            provider: IdentityProvider.google,
            providerSubject,
            providerIssuer,
            email: normalizedEmail,
            emailVerified,
          },
          select: {
            id: true,
            emailVerified: true,
          },
        });
        identityRecord = {
          id: createdIdentity.id,
          emailVerified: createdIdentity.emailVerified,
          user: existingUser,
        };
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          identityRecord = await findIdentityWithUser();
          if (identityRecord && identityRecord.user.id !== existingUser.id) {
            throw createAuthError(
              409,
              "Google account is already linked to another user.",
            );
          }
        } else {
          throw error;
        }
      }
    } else {
      // No prior record exists, so create a new active student linked to the Google identity.
      try {
        identityRecord = await prisma.$transaction(async (tx) => {
          const createdUser = await tx.user.create({
            data: {
              email: normalizedEmail,
              fullName,
              password: null,
              role: UserRole.student,
              status: UserStatus.active,
            },
            select: selectUserFields,
          });

          const createdIdentity = await tx.identity.create({
            data: {
              userId: createdUser.id,
              provider: IdentityProvider.google,
              providerSubject,
              providerIssuer,
              email: normalizedEmail,
              emailVerified,
            },
            select: {
              id: true,
              emailVerified: true,
            },
          });

          return {
            id: createdIdentity.id,
            emailVerified: createdIdentity.emailVerified,
            user: createdUser,
          };
        });
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          identityRecord = await findIdentityWithUser();

          if (!identityRecord) {
            // A conflicting insert happened in parallel; fall back to linking the existing email owner.
            const fallbackUser = await prisma.user.findFirst({
              where: {
                email: normalizedEmail,
                deletedAt: null,
              },
              select: selectUserFields,
            });

            if (!fallbackUser) {
              throw createAuthError(
                409,
                "Google account could not be linked. Please try again.",
              );
            }

            assertUserIsActive(fallbackUser);
            try {
              const createdIdentity = await prisma.identity.create({
                data: {
                  userId: fallbackUser.id,
                  provider: IdentityProvider.google,
                  providerSubject,
                  providerIssuer,
                  email: normalizedEmail,
                  emailVerified,
                },
                select: {
                  id: true,
                  emailVerified: true,
                },
              });
              identityRecord = {
                id: createdIdentity.id,
                emailVerified: createdIdentity.emailVerified,
                user: fallbackUser,
              };
            } catch (nestedError) {
              if (isUniqueConstraintError(nestedError)) {
                identityRecord = await findIdentityWithUser();
                if (
                  identityRecord &&
                  identityRecord.user.id !== fallbackUser.id
                ) {
                  throw createAuthError(
                    409,
                    "Google account is already linked to another user.",
                  );
                }
              } else {
                throw nestedError;
              }
            }
          }
        } else {
          throw error;
        }
      }
    }
  }

  if (!identityRecord) {
    throw createAuthError(
      500,
      "Unable to link Google account. Please try again later.",
    );
  }

  return identityRecord;
}
