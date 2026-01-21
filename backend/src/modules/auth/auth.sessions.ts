/**
 * File: src/modules/auth/auth.sessions.ts
 * Purpose: Persist, rotate, and sanitize refresh session data.
 * Why: Keeps session logic consistent across password, refresh, and OAuth flows.
 */
import { prisma } from "../../config/prismaClient.js";
import { hashValue } from "./auth.crypto.js";
import type { SessionContext } from "./auth.types.js";

export const REFRESH_TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 14; // 14 days
const MAX_USER_AGENT_LENGTH = 256;

const computeExpiry = (): Date => new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

const truncate = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }
  return value.length > MAX_USER_AGENT_LENGTH
    ? value.slice(0, MAX_USER_AGENT_LENGTH)
    : value;
};

const sanitizeSessionMetadata = (context: SessionContext) => ({
  userAgent: truncate(context.userAgent ?? null),
  ipHash:
    context.ipAddress && context.ipAddress.length > 0
      ? hashValue(context.ipAddress)
      : null,
});

export async function persistSession(
  userId: string,
  refreshToken: string,
  context: SessionContext,
): Promise<{ refreshToken: string; expiresAt: Date }> {
  const { userAgent, ipHash } = sanitizeSessionMetadata(context);

  const refreshTokenHash = hashValue(refreshToken);
  const expiresAt = computeExpiry();

  await prisma.authSession.create({
    data: {
      userId,
      refreshTokenHash,
      expiresAt,
      userAgent,
      ipHash,
    },
  });

  return {
    refreshToken,
    expiresAt,
  };
}

export async function rotateSession(
  sessionId: string,
  refreshToken: string,
  context: SessionContext,
): Promise<{ refreshToken: string; expiresAt: Date }> {
  const { userAgent, ipHash } = sanitizeSessionMetadata(context);

  const refreshTokenHash = hashValue(refreshToken);
  const expiresAt = computeExpiry();

  await prisma.authSession.update({
    where: { id: sessionId },
    data: {
      refreshTokenHash,
      expiresAt,
      userAgent,
      ipHash,
      revokedAt: null,
    },
  });

  return {
    refreshToken,
    expiresAt,
  };
}
