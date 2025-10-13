/**
 * File: src/modules/auth/auth.service.ts
 * Purpose: Implement password-based authentication, issuing JWT access tokens and managing refresh sessions.
 * Why: Enables the backend to authenticate real users while keeping controllers thin and transport-agnostic.
 */
import { randomBytes, createHash, timingSafeEqual } from "node:crypto";

import { IdentityProvider, Prisma, UserRole, UserStatus } from "@prisma/client";
import bcrypt from "bcrypt";

import { config } from "../../config/env.js";
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

type ActiveUserRecord = {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  status: UserStatus;
};

type IdentityWithUser = {
  id: string;
  emailVerified: boolean;
  user: ActiveUserRecord;
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

const GOOGLE_AUTHORIZATION_ENDPOINT =
  "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_ENDPOINT =
  "https://openidconnect.googleapis.com/v1/userinfo";
const GOOGLE_ALLOWED_ISSUERS = new Set([
  "https://accounts.google.com",
  "accounts.google.com",
]);
const GOOGLE_SCOPE = "openid email profile";

const PKCE_CODE_VERIFIER_MIN_LENGTH = 43;
const PKCE_CODE_VERIFIER_MAX_LENGTH = 128;

const base64UrlEncode = (buffer: Buffer): string =>
  buffer
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");

const generateState = (): string => base64UrlEncode(randomBytes(32));

const generatePkceCodeVerifier = (): string => {
  let verifier = base64UrlEncode(randomBytes(32));
  if (verifier.length < PKCE_CODE_VERIFIER_MIN_LENGTH) {
    const additional = base64UrlEncode(randomBytes(48));
    verifier = `${verifier}${additional}`.slice(
      0,
      PKCE_CODE_VERIFIER_MIN_LENGTH,
    );
  }
  if (verifier.length > PKCE_CODE_VERIFIER_MAX_LENGTH) {
    verifier = verifier.slice(0, PKCE_CODE_VERIFIER_MAX_LENGTH);
  }
  return verifier;
};

const derivePkceCodeChallenge = (verifier: string): string => {
  const digest = createHash("sha256").update(verifier).digest();
  return base64UrlEncode(digest);
};

const timingSafeMatch = (first: string, second: string): boolean => {
  const firstBuffer = Buffer.from(first);
  const secondBuffer = Buffer.from(second);
  if (firstBuffer.length !== secondBuffer.length) {
    return false;
  }
  return timingSafeEqual(firstBuffer, secondBuffer);
};

type GoogleTokenResponse = {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
  id_token: string;
  refresh_token?: string;
};

type GoogleIdTokenPayload = {
  iss: string;
  aud: string | string[];
  sub: string;
  email?: string;
  email_verified?: boolean;
  at_hash?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
};

type GoogleUserInfo = {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
};

type BuildGoogleAuthorizationOptions = {
  redirectUri: string;
};

type GoogleAuthorizationBuildResult = {
  authorizationUrl: string;
  state: string;
  codeVerifier: string;
};

type CompleteGoogleAuthorizationOptions = {
  redirectUri: string;
  expectedState: string | null;
  codeVerifier: string | null;
  context: SessionContext;
};

const decodeIdToken = (idToken: string): GoogleIdTokenPayload => {
  const parts = idToken.split(".");
  if (parts.length !== 3) {
    throw createAuthError(401, "Google sign-in returned an invalid token.");
  }

  try {
    const payloadSegment = parts[1] ?? "";
    const payloadJson = Buffer.from(payloadSegment, "base64url").toString(
      "utf8",
    );
    const payload = JSON.parse(payloadJson) as GoogleIdTokenPayload;
    return payload;
  } catch {
    throw createAuthError(401, "Unable to read Google identity token.");
  }
};

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

const assertUserIsActive = (user: { status: UserStatus }): void => {
  if (user.status !== UserStatus.active) {
    throw createAuthError(
      403,
      "Account is not active. Contact support for assistance.",
    );
  }
};

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

export async function buildGoogleAuthorizationUrl(
  options: BuildGoogleAuthorizationOptions,
): Promise<GoogleAuthorizationBuildResult> {
  const { redirectUri } = options;

  if (!redirectUri) {
    throw createAuthError(
      500,
      "Google redirect URI is not configured for this environment.",
    );
  }

  try {
    // Validate the URI so we fail fast if misconfigured.
    new URL(redirectUri);
  } catch {
    throw createAuthError(
      500,
      "Google redirect URI is invalid. Check the server configuration.",
    );
  }

  const state = generateState();
  const codeVerifier = generatePkceCodeVerifier();
  const codeChallenge = derivePkceCodeChallenge(codeVerifier);

  const params = new URLSearchParams({
    client_id: config.google.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_SCOPE,
    access_type: "offline",
    include_granted_scopes: "true",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  });

  return {
    authorizationUrl: `${GOOGLE_AUTHORIZATION_ENDPOINT}?${params.toString()}`,
    state,
    codeVerifier,
  };
}

export async function completeGoogleAuthorization(
  query: unknown,
  options: CompleteGoogleAuthorizationOptions,
): Promise<AuthSessionResult> {
  const { redirectUri, expectedState, codeVerifier, context } = options;

  if (!redirectUri) {
    throw createAuthError(
      500,
      "Google redirect URI is not configured for this environment.",
    );
  }

  try {
    new URL(redirectUri);
  } catch {
    throw createAuthError(
      500,
      "Google redirect URI is invalid. Check the server configuration.",
    );
  }

  const { code, state } = googleAuthCallbackSchema.parse(query);

  if (!expectedState || !timingSafeMatch(expectedState, state)) {
    throw createAuthError(
      400,
      "Google sign-in state is invalid or expired. Please try again.",
    );
  }

  if (
    !codeVerifier ||
    codeVerifier.length < PKCE_CODE_VERIFIER_MIN_LENGTH ||
    codeVerifier.length > PKCE_CODE_VERIFIER_MAX_LENGTH
  ) {
    throw createAuthError(
      400,
      "Google sign-in verifier is invalid or expired. Please try again.",
    );
  }

  let tokenPayload: GoogleTokenResponse;
  try {
    const tokenResponse = await fetch(GOOGLE_TOKEN_ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code,
        client_id: config.google.clientId,
        client_secret: config.google.clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
        code_verifier: codeVerifier,
      }).toString(),
    });

    if (!tokenResponse.ok) {
      throw new Error(`Token exchange failed: ${tokenResponse.status}`);
    }

    tokenPayload = (await tokenResponse.json()) as GoogleTokenResponse;
  } catch (error) {
    throw createAuthError(
      401,
      "Unable to complete Google sign-in. Please try again.",
    );
  }

  if (
    !tokenPayload.access_token ||
    tokenPayload.token_type !== "Bearer" ||
    !tokenPayload.id_token
  ) {
    throw createAuthError(
      401,
      "Google did not return the expected tokens. Please try again.",
    );
  }

  const idToken = decodeIdToken(tokenPayload.id_token);
  const audience = Array.isArray(idToken.aud) ? idToken.aud : [idToken.aud];
  if (!audience.includes(config.google.clientId)) {
    throw createAuthError(
      401,
      "Google identity token audience mismatch detected.",
    );
  }

  if (!GOOGLE_ALLOWED_ISSUERS.has(idToken.iss)) {
    throw createAuthError(
      401,
      "Google identity token issuer is not trusted.",
    );
  }

  let profile: GoogleUserInfo;
  try {
    const userInfoResponse = await fetch(GOOGLE_USERINFO_ENDPOINT, {
      headers: {
        authorization: `Bearer ${tokenPayload.access_token}`,
      },
    });

    if (!userInfoResponse.ok) {
      throw new Error(
        `userinfo request failed: ${userInfoResponse.statusText}`,
      );
    }

    profile = (await userInfoResponse.json()) as GoogleUserInfo;
  } catch {
    throw createAuthError(
      401,
      "Unable to read Google account profile information.",
    );
  }

  if (profile.sub !== idToken.sub) {
    throw createAuthError(
      401,
      "Google identity token does not match profile information.",
    );
  }

  const normalizedEmail = (profile.email ?? idToken.email)?.toLowerCase();
  if (!normalizedEmail) {
    throw createAuthError(
      400,
      "Google account is missing an email address. Update your Google profile and try again.",
    );
  }

  const emailVerified =
    profile.email_verified === true || idToken.email_verified === true;
  if (!emailVerified) {
    throw createAuthError(
      400,
      "Google account email must be verified before signing in.",
    );
  }

  const deriveFullName = (): string => {
    const fromProfile = profile.name?.trim();
    if (fromProfile && fromProfile.length > 0) {
      return fromProfile;
    }
    const combined = `${profile.given_name ?? ""} ${
      profile.family_name ?? ""
    }`.trim();
    if (combined.length > 0) {
      return combined;
    }
    const [localPart] = normalizedEmail.split("@");
    return localPart ?? normalizedEmail;
  };

  const providerSubject = profile.sub;
  const providerIssuer = idToken.iss ?? "https://accounts.google.com";

  const selectUserFields = {
    id: true,
    email: true,
    fullName: true,
    role: true,
    status: true,
  } as const;

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
          if (
            identityRecord &&
            identityRecord.user.id !== existingUser.id
          ) {
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
              fullName: deriveFullName(),
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

  const finalUser = identityRecord.user;
  assertUserIsActive(finalUser);

  if (emailVerified && !identityRecord.emailVerified) {
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

export { REFRESH_TOKEN_TTL_MS };
