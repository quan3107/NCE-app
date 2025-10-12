/**
 * File: src/modules/auth/auth.service.ts
 * Purpose: Implement password-based authentication, issuing JWT access tokens and managing refresh sessions.
 * Why: Enables the backend to authenticate real users while keeping controllers thin and transport-agnostic.
 */
import { randomBytes, createHash } from "node:crypto";

import { Prisma, UserRole, UserStatus } from "@prisma/client";
import bcrypt from "bcrypt";

import { prisma } from "../../config/prismaClient.js";
import {
  googleAuthCallbackSchema,
  registerAccountSchema,
  passwordLoginSchema,
  refreshSessionSchema,
} from "./auth.schema.js";
import { signAccessToken } from "./auth.tokens.js";

export type AuthenticatedUser = {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
};

export type AuthSessionResult = {
  user: AuthenticatedUser;
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
};

export type SessionContext = {
  ipAddress?: string | null;
  userAgent?: string | null;
  refreshToken?: string | null;
};

const REFRESH_TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 14; // 14 days
const MAX_USER_AGENT_LENGTH = 256;
const PASSWORD_SALT_ROUNDS = 12;

const AUTH_ERROR = "Invalid email or password";

const hashValue = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

const truncate = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }
  return value.length > MAX_USER_AGENT_LENGTH
    ? value.slice(0, MAX_USER_AGENT_LENGTH)
    : value;
};

const toAuthenticatedUser = (record: {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
}): AuthenticatedUser => ({
  id: record.id,
  email: record.email,
  fullName: record.fullName,
  role: record.role,
});

const createAuthError = (statusCode: number, message: string): Error & {
  statusCode: number;
  expose: boolean;
} => {
  const error = new Error(message) as Error & {
    statusCode: number;
    expose: boolean;
  };
  error.statusCode = statusCode;
  error.expose = statusCode < 500;
  return error;
};

const generateRefreshToken = (): string =>
  randomBytes(48).toString("base64url");

const computeExpiry = (): Date => new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

const sanitizeSessionMetadata = (context: SessionContext) => ({
  userAgent: truncate(context.userAgent ?? null),
  ipHash:
    context.ipAddress && context.ipAddress.length > 0
      ? hashValue(context.ipAddress)
      : null,
});

async function persistSession(
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

async function rotateSession(
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

function assertActiveUser(user: {
  status: UserStatus;
  password: string | null;
}): void {
  if (!user.password) {
    throw createAuthError(401, AUTH_ERROR);
  }

  if (user.status !== UserStatus.active) {
    throw createAuthError(
      403,
      "Account is not active. Contact support for assistance.",
    );
  }
}

export async function handlePasswordLogin(
  payload: unknown,
  context: SessionContext,
): Promise<AuthSessionResult> {
  const { email, password } = passwordLoginSchema.parse(payload);

  const user = await prisma.user.findFirst({
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
  });

  if (!user) {
    throw createAuthError(401, AUTH_ERROR);
  }

  assertActiveUser(user);

  const passwordValid = await bcrypt.compare(password, user.password!);

  if (!passwordValid) {
    throw createAuthError(401, AUTH_ERROR);
  }

  const refreshToken = generateRefreshToken();
  const session = await persistSession(user.id, refreshToken, context);

  const accessToken = signAccessToken({
    userId: user.id,
    role: user.role,
  });

  return {
    user: toAuthenticatedUser(user),
    accessToken,
    refreshToken: session.refreshToken,
    refreshTokenExpiresAt: session.expiresAt,
  };
}

const isUniqueConstraintError = (
  error: unknown,
): error is Prisma.PrismaClientKnownRequestError =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === "P2002";

export async function handleRegisterAccount(
  payload: unknown,
  context: SessionContext,
): Promise<AuthSessionResult> {
  const parsed = registerAccountSchema.parse(payload);

  const existing = await prisma.user.findFirst({
    where: {
      email: parsed.email,
      deletedAt: null,
    },
    select: {
      id: true,
    },
  });

  if (existing) {
    throw createAuthError(409, "An account with that email already exists.");
  }

  const passwordHash = await bcrypt.hash(parsed.password, PASSWORD_SALT_ROUNDS);

  try {
    const userRecord = await prisma.user.create({
      data: {
        email: parsed.email,
        fullName: parsed.fullName,
        password: passwordHash,
        role: parsed.role,
        status: UserStatus.active,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
      },
    });

    const refreshToken = generateRefreshToken();
    const session = await persistSession(userRecord.id, refreshToken, context);

    const accessToken = signAccessToken({
      userId: userRecord.id,
      role: userRecord.role,
    });

    return {
      user: toAuthenticatedUser(userRecord),
      accessToken,
      refreshToken: session.refreshToken,
      refreshTokenExpiresAt: session.expiresAt,
    };
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw createAuthError(409, "An account with that email already exists.");
    }
    throw error;
  }
}

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

  assertActiveUser(user);

  const nextRefreshToken = generateRefreshToken();
  const rotated = await rotateSession(
    session.id,
    nextRefreshToken,
    context,
  );

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

export async function buildGoogleAuthorizationUrl(): Promise<void> {
  // Google OIDC authorization URL generation will be implemented later.
}

export async function completeGoogleAuthorization(
  query: unknown,
): Promise<void> {
  googleAuthCallbackSchema.parse(query);
}

export { REFRESH_TOKEN_TTL_MS };
