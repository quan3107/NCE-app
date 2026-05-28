/**
 * File: tests/modules/auth/auth.google.token-verification.test.ts
 * Purpose: Validate fail-closed Google ID token handling.
 * Why: Keeps OAuth token verification checks explicit and separate from happy-path service tests.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  completeGoogleAuthorization,
  fetchMock,
  fixedDate,
  googleRemoteJwksMock,
  jwtVerifyMock,
  prisma,
  resetAuthServiceMocks,
} from "./auth.service.test-utils.js";

type GoogleTokenResponseFixture = {
  access_token: string;
  token_type: string;
  scope: string;
  expires_in: number;
  id_token: string;
};

const state = "state-value";
const codeVerifier = "a".repeat(64);
const nowSeconds = Math.floor(fixedDate.getTime() / 1000);

const buildGoogleIdToken = (payload: Record<string, unknown>): string =>
  [
    Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString(
      "base64url",
    ),
    Buffer.from(JSON.stringify(payload)).toString("base64url"),
    "signature",
  ].join(".");

const buildVerifiedPayload = (
  overrides: Record<string, unknown> = {},
): Record<string, unknown> => ({
  iss: "https://accounts.google.com",
  aud: "test-google-client-id",
  sub: "google-123",
  email: "existing@example.com",
  email_verified: true,
  iat: nowSeconds,
  exp: nowSeconds + 3600,
  ...overrides,
});

const mockTokenExchange = (
  idToken: string,
  overrides: Partial<GoogleTokenResponseFixture> = {},
): void => {
  fetchMock.mockResolvedValueOnce({
    ok: true,
    json: async () =>
      ({
        access_token: "access-token",
        token_type: "Bearer",
        scope: "openid email profile",
        expires_in: 3600,
        id_token: idToken,
        ...overrides,
      }) as GoogleTokenResponseFixture,
  });
};

const mockUserInfo = (overrides: Record<string, unknown> = {}): void => {
  fetchMock.mockResolvedValueOnce({
    ok: true,
    json: async () =>
      ({
        sub: "google-123",
        email: "existing@example.com",
        email_verified: true,
        name: "Existing User",
        ...overrides,
      }) as const,
  });
};

const completeGoogle = () =>
  completeGoogleAuthorization(
    { code: "auth-code", state },
    {
      redirectUri: "https://app.example.com/api/v1/auth/google/callback",
      expectedState: state,
      codeVerifier,
      context: { ipAddress: "127.0.0.1", userAgent: "oauth-test" },
    },
  );

describe("auth.service Google OAuth token verification", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(fixedDate);
    resetAuthServiceMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it.each([
    "wrong audience",
    "wrong issuer",
    "expired token",
    "invalid signature",
  ])("rejects a Google ID token with %s", async (reason) => {
    const idToken = buildGoogleIdToken(buildVerifiedPayload());

    jwtVerifyMock.mockRejectedValueOnce(new Error(reason));
    mockTokenExchange(idToken);

    await expect(completeGoogle()).rejects.toMatchObject({
      statusCode: 401,
      message: "Google identity token could not be verified.",
    });

    expect(jwtVerifyMock).toHaveBeenCalledWith(
      idToken,
      googleRemoteJwksMock,
      expect.any(Object),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(prisma.identity.findFirst).not.toHaveBeenCalled();
  });

  it("rejects verified Google ID tokens without a subject", async () => {
    const payload = buildVerifiedPayload({ sub: undefined });
    const idToken = buildGoogleIdToken(payload);

    jwtVerifyMock.mockResolvedValueOnce({
      payload,
      protectedHeader: { alg: "RS256", typ: "JWT" },
    });
    mockTokenExchange(idToken);

    await expect(completeGoogle()).rejects.toMatchObject({
      statusCode: 401,
      message: "Google identity token subject is missing.",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(prisma.identity.findFirst).not.toHaveBeenCalled();
  });

  it("rejects Google token responses with a bad token type", async () => {
    const payload = buildVerifiedPayload();
    const idToken = buildGoogleIdToken(payload);

    mockTokenExchange(idToken, { token_type: "bearer" });

    await expect(completeGoogle()).rejects.toMatchObject({
      statusCode: 401,
      message: "Google did not return the expected tokens. Please try again.",
    });

    expect(jwtVerifyMock).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(prisma.identity.findFirst).not.toHaveBeenCalled();
  });

  it("rejects Google profiles with no email in token or UserInfo", async () => {
    const payload = buildVerifiedPayload({ email: undefined });
    const idToken = buildGoogleIdToken(payload);

    jwtVerifyMock.mockResolvedValueOnce({
      payload,
      protectedHeader: { alg: "RS256", typ: "JWT" },
    });
    mockTokenExchange(idToken);
    mockUserInfo({ email: undefined });

    await expect(completeGoogle()).rejects.toMatchObject({
      statusCode: 400,
      message:
        "Google account is missing an email address. Update your Google profile and try again.",
    });

    expect(prisma.identity.findFirst).not.toHaveBeenCalled();
  });

  it("rejects Google profiles without a verified email", async () => {
    const payload = buildVerifiedPayload({ email_verified: false });
    const idToken = buildGoogleIdToken(payload);

    jwtVerifyMock.mockResolvedValueOnce({
      payload,
      protectedHeader: { alg: "RS256", typ: "JWT" },
    });
    mockTokenExchange(idToken);
    mockUserInfo({ email_verified: false });

    await expect(completeGoogle()).rejects.toMatchObject({
      statusCode: 400,
      message: "Google account email must be verified before signing in.",
    });

    expect(prisma.identity.findFirst).not.toHaveBeenCalled();
  });

  it("rejects Google UserInfo when the subject does not match the ID token", async () => {
    const payload = buildVerifiedPayload();
    const idToken = buildGoogleIdToken(payload);

    jwtVerifyMock.mockResolvedValueOnce({
      payload,
      protectedHeader: { alg: "RS256", typ: "JWT" },
    });
    mockTokenExchange(idToken);
    mockUserInfo({ sub: "google-456" });

    await expect(completeGoogle()).rejects.toMatchObject({
      statusCode: 401,
      message: "Google identity token does not match profile information.",
    });

    expect(prisma.identity.findFirst).not.toHaveBeenCalled();
  });
});
