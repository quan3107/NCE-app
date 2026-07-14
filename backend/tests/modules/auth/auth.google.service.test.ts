/**
 * File: tests/modules/auth/auth.google.service.test.ts
 * Purpose: Validate Google OAuth authorization flows in the auth service.
 * Why: Keeps OAuth behavior covered while auth tests remain small and focused.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UserRole } from "../../../src/prisma/index.js";
import {
  buildAuthSession,
  buildGoogleAuthorizationUrl,
  buildIdentity,
  completeGoogleAuthorization,
  crypto,
  fetchMock,
  fixedDate,
  googleRemoteJwksMock,
  isRoleContextActive,
  jwtVerifyMock,
  prisma,
  randomBytesMock,
  resetAuthServiceMocks,
  writeAuditLogSafely,
} from "./auth.service.test-utils.js";

const buildGoogleIdToken = (payload: Record<string, unknown>): string =>
  [
    Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString(
      "base64url",
    ),
    Buffer.from(JSON.stringify(payload)).toString("base64url"),
    "signature",
  ].join(".");

describe("auth.service Google OAuth", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(fixedDate);
    resetAuthServiceMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("builds Google authorization url with PKCE settings", async () => {
    randomBytesMock
      .mockImplementationOnce((size?: number) => Buffer.alloc(size ?? 32, 2))
      .mockImplementationOnce((size?: number) => Buffer.alloc(size ?? 32, 3));

    const redirectUri =
      "https://app.example.com/api/v1/auth/google/callback";

    const result = await buildGoogleAuthorizationUrl({ redirectUri });

    expect(result.state).toBeTruthy();
    expect(result.codeVerifier.length).toBeGreaterThanOrEqual(43);
    expect(result.codeVerifier.length).toBeLessThanOrEqual(128);

    const url = new URL(result.authorizationUrl);
    expect(url.origin).toBe("https://accounts.google.com");
    expect(url.searchParams.get("client_id")).toBe(
      "test-google-client-id",
    );
    expect(url.searchParams.get("redirect_uri")).toBe(redirectUri);
    expect(url.searchParams.get("scope")).toBe("openid email profile");
    expect(url.searchParams.get("state")).toBe(result.state);
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");

    const expectedChallenge = crypto
      .createHash("sha256")
      .update(result.codeVerifier)
      .digest("base64url");
    expect(url.searchParams.get("code_challenge")).toBe(
      expectedChallenge,
    );
  });

  it("completes Google authorization for an existing identity", async () => {
    writeAuditLogSafely.mockImplementationOnce(async () => {
      expect(isRoleContextActive()).toBe(true);
    });
    const state = "state-value";
    const codeVerifier = "a".repeat(64);

    const idTokenPayload = {
      iss: "https://accounts.google.com",
      aud: "test-google-client-id",
      sub: "google-123",
      email: "existing@example.com",
      email_verified: true,
      iat: Math.floor(fixedDate.getTime() / 1000),
      exp: Math.floor(fixedDate.getTime() / 1000) + 3600,
    };
    const idToken = buildGoogleIdToken(idTokenPayload);

    jwtVerifyMock.mockResolvedValueOnce({
      payload: idTokenPayload,
      protectedHeader: { alg: "RS256", typ: "JWT" },
    });

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () =>
        ({
          access_token: "access-token",
          token_type: "Bearer",
          scope: "openid email profile",
          expires_in: 3600,
          id_token: idToken,
        }) as const,
    });

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () =>
        ({
          sub: "google-123",
          email: "existing@example.com",
          email_verified: true,
          name: "Existing User",
        }) as const,
    });

    prisma.identity.findFirst.mockResolvedValueOnce(
      buildIdentity(
        {
          id: "identity-1",
          userId: "user-1",
          email: "existing@example.com",
          emailVerified: false,
        },
        {
          id: "user-1",
          email: "existing@example.com",
          fullName: "Existing User",
          role: UserRole.teacher,
        },
      ),
    );
    prisma.identity.update.mockResolvedValueOnce(
      buildIdentity(
        {
          id: "identity-1",
          userId: "user-1",
          email: "existing@example.com",
          emailVerified: true,
        },
        {
          id: "user-1",
          email: "existing@example.com",
          fullName: "Existing User",
          role: UserRole.teacher,
        },
      ),
    );
    prisma.authSession.create.mockResolvedValueOnce(
      buildAuthSession({ id: "session-google-login", userId: "user-1" }),
    );

    const result = await completeGoogleAuthorization(
      { code: "auth-code", state },
      {
        redirectUri:
          "https://app.example.com/api/v1/auth/google/callback",
        expectedState: state,
        codeVerifier,
        context: { ipAddress: "127.0.0.1", userAgent: "oauth-test" },
      },
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://oauth2.googleapis.com/token",
      expect.objectContaining({ method: "POST" }),
    );
    const tokenCall = fetchMock.mock.calls[0]?.[1];
    expect(tokenCall?.body).toContain("code=auth-code");
    expect(tokenCall?.body).toContain(`code_verifier=${codeVerifier}`);
    expect(jwtVerifyMock).toHaveBeenCalledWith(
      idToken,
      googleRemoteJwksMock,
      expect.objectContaining({
        algorithms: ["RS256"],
        audience: "test-google-client-id",
        clockTolerance: "5 minutes",
        issuer: ["https://accounts.google.com", "accounts.google.com"],
        maxTokenAge: "1 hour",
        requiredClaims: ["exp", "iat", "sub"],
        typ: "JWT",
      }),
    );

    expect(result.accessToken).toBe("signed-access");
    expect(result.user).toEqual({
      id: "user-1",
      email: "existing@example.com",
      fullName: "Existing User",
      role: "teacher",
    });
    expect(prisma.identity.update).toHaveBeenCalledWith({
      where: { id: "identity-1" },
      data: { emailVerified: true },
    });

    expect(prisma.identity.create).not.toHaveBeenCalled();
    const sessionCall = prisma.authSession.create.mock.calls[0]?.[0];
    expect(sessionCall?.data.userId).toBe("user-1");
    expect(sessionCall?.data.userAgent).toBe("oauth-test");
    expect(sessionCall?.data.ipHash).toBe(
      crypto.createHash("sha256").update("127.0.0.1").digest("hex"),
    );
    expect(writeAuditLogSafely).toHaveBeenCalledWith({
      actorId: "user-1",
      action: "auth.google_login_succeeded",
      entity: "auth_session",
      entityId: "session-google-login",
      diff: {
        userId: "user-1",
        identityId: "identity-1",
        role: "teacher",
        status: "active",
        emailVerifiedUpdated: true,
      },
      requestMetadata: {
        ipAddress: "127.0.0.1",
        userAgent: "oauth-test",
      },
    });
    const auditPayload = JSON.stringify(writeAuditLogSafely.mock.calls);
    expect(auditPayload).not.toContain("access-token");
    expect(auditPayload).not.toContain(idToken);
  });
});
