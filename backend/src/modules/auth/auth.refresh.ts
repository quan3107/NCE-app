/**
 * File: src/modules/auth/auth.refresh.ts
 * Purpose: Refresh and revoke auth sessions using refresh tokens.
 * Why: Centralizes refresh/logout flow handling outside password and OAuth modules.
 */
import { prisma } from "../../config/prismaClient.js";
import { refreshSessionSchema } from "./auth.schema.js";
import { createAuthError } from "./auth.errors.js";
import { generateRefreshToken, hashValue } from "./auth.crypto.js";
import { rotateSession } from "./auth.sessions.js";
import { assertActiveUser, toAuthenticatedUser } from "./auth.users.js";
import { signAccessToken } from "./auth.tokens.js";
import type { AuthSessionResult, SessionContext } from "./auth.types.js";

export async function handleSessionRefresh(
  payload: unknown,
  context: SessionContext,
): Promise<AuthSessionResult> {
  const parsed = refreshSessionSchema.safeParse(payload);

  const refreshToken =
    typeof context.refreshToken === "string" && context.refreshToken.length > 0
      ? context.refreshToken
      : parsed.success
        ? parsed.data.refreshToken
        : null;

  if (!refreshToken) {
    throw createAuthError(401, "Refresh token is missing.");
  }

  const now = new Date();
  const refreshTokenHash = hashValue(refreshToken);

  const session = await prisma.authSession.findFirst({
    where: {
      refreshTokenHash,
      revokedAt: null,
      expiresAt: {
        gt: now,
      },
    },
    select: {
      id: true,
      userId: true,
    },
  });

  if (!session) {
    throw createAuthError(401, "Refresh token is invalid or expired.");
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
  });

  if (!user) {
    await prisma.authSession.update({
      where: { id: session.id },
      data: {
        revokedAt: now,
      },
    });
    throw createAuthError(401, "Account is no longer available.");
  }

  assertActiveUser(user, { requirePassword: false });

  const nextRefreshToken = generateRefreshToken();
  const rotated = await rotateSession(session.id, nextRefreshToken, context);

  const accessToken = signAccessToken({
    userId: user.id,
    role: user.role,
  });

  return {
    user: toAuthenticatedUser(user),
    accessToken,
    refreshToken: rotated.refreshToken,
    refreshTokenExpiresAt: rotated.expiresAt,
  };
}

export async function handleLogout(
  payload: unknown,
  context: SessionContext,
): Promise<void> {
  const parsed = refreshSessionSchema.safeParse(payload);

  const refreshToken =
    typeof context.refreshToken === "string" && context.refreshToken.length > 0
      ? context.refreshToken
      : parsed.success
        ? parsed.data.refreshToken
        : null;

  if (!refreshToken) {
    return;
  }

  const refreshTokenHash = hashValue(refreshToken);

  await prisma.authSession.updateMany({
    where: {
      refreshTokenHash,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });
}
