/**
 * File: src/modules/auth/auth.sessions.ts
 * Purpose: Persist, rotate, and sanitize refresh session data.
 * Why: Keeps session logic consistent across password, refresh, and OAuth flows.
 */
import { randomUUID } from "node:crypto";

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

  const sessionId = randomUUID();
  const refreshTokenHash = hashValue(refreshToken);
  const expiresAt = computeExpiry();

  await prisma.authSession.create({
    data: {
      id: sessionId,
      userId,
      familyId: sessionId,
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
  session: { id: string; userId: string; familyId: string },
  refreshToken: string,
  context: SessionContext,
): Promise<{ refreshToken: string; expiresAt: Date }> {
  const { userAgent, ipHash } = sanitizeSessionMetadata(context);

  const refreshTokenHash = hashValue(refreshToken);
  const expiresAt = computeExpiry();
  const replacedAt = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.authSession.update({
      where: { id: session.id },
      data: {
        replacedAt,
      },
    });

    await tx.authSession.create({
      data: {
        userId: session.userId,
        familyId: session.familyId,
        rotatedFromId: session.id,
        refreshTokenHash,
        expiresAt,
        userAgent,
        ipHash,
      },
    });
  });

  return {
    refreshToken,
    expiresAt,
  };
}

export async function revokeSessionFamily(
  familyId: string,
  revokedAt: Date,
): Promise<void> {
  await prisma.authSession.updateMany({
    where: {
      familyId,
      revokedAt: null,
    },
    data: {
      revokedAt,
      reuseDetectedAt: revokedAt,
    },
  });
}
