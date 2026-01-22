/**
 * File: src/modules/auth/auth.google.ts
 * Purpose: Orchestrate Google OAuth sign-in flows.
 * Why: Keeps controller-facing Google auth entry points compact and focused.
 */
import { prisma } from "../../config/prismaClient.js";
import { googleAuthCallbackSchema } from "./auth.schema.js";
import { createAuthError } from "./auth.errors.js";
import { generateRefreshToken, timingSafeMatch } from "./auth.crypto.js";
import { persistSession } from "./auth.sessions.js";
import { assertUserIsActive, toAuthenticatedUser } from "./auth.users.js";
import { signAccessToken } from "./auth.tokens.js";
import {
  assertValidCodeVerifier,
  assertValidRedirectUri,
  buildGoogleAuthorizationUrl,
} from "./auth.google.oauth.js";
import { fetchGoogleProfile } from "./auth.google.profile.js";
import { findOrCreateGoogleIdentity } from "./auth.google.identity.js";
import type { AuthSessionResult, SessionContext } from "./auth.types.js";

type CompleteGoogleAuthorizationOptions = {
  redirectUri: string;
  expectedState: string | null;
  codeVerifier: string | null;
  context: SessionContext;
};

export { buildGoogleAuthorizationUrl };

export async function completeGoogleAuthorization(
  query: unknown,
  options: CompleteGoogleAuthorizationOptions,
): Promise<AuthSessionResult> {
  const { redirectUri, expectedState, codeVerifier, context } = options;

  assertValidRedirectUri(redirectUri);

  const { code, state } = googleAuthCallbackSchema.parse(query);

  if (!expectedState || !timingSafeMatch(expectedState, state)) {
    throw createAuthError(
      400,
      "Google sign-in state is invalid or expired. Please try again.",
    );
  }

  assertValidCodeVerifier(codeVerifier);

  const profile = await fetchGoogleProfile({
    code,
    redirectUri,
    codeVerifier,
  });

  const identityRecord = await findOrCreateGoogleIdentity(profile);

  const finalUser = identityRecord.user;
  assertUserIsActive(finalUser);

  if (profile.emailVerified && !identityRecord.emailVerified) {
    await prisma.identity.update({
      where: { id: identityRecord.id },
      data: {
        emailVerified: true,
      },
    });
  }

  const refreshToken = generateRefreshToken();
  const session = await persistSession(finalUser.id, refreshToken, {
    ...context,
  });

  const accessToken = signAccessToken({
    userId: finalUser.id,
    role: finalUser.role,
  });

  return {
    user: toAuthenticatedUser(finalUser),
    accessToken,
    refreshToken: session.refreshToken,
    refreshTokenExpiresAt: session.expiresAt,
  };
}
