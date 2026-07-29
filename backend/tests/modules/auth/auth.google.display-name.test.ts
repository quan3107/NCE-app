/**
 * File: tests/modules/auth/auth.google.display-name.test.ts
 * Purpose: Verify Google-created users obey the shared display-name policy.
 * Why: OAuth-derived names must not bypass identity text validation.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  completeGoogleAuthorization,
  fetchMock,
  fixedDate,
  jwtVerifyMock,
  prisma,
  resetAuthServiceMocks,
} from "./auth.service.test-utils.js";

const buildGoogleIdToken = (payload: Record<string, unknown>): string =>
  [
    Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url"),
    Buffer.from(JSON.stringify(payload)).toString("base64url"),
    "signature",
  ].join(".");

describe("Google OAuth display names", () => {
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
    {
      label: "provider control characters",
      email: "new-user@example.com",
      profile: { name: "\u202eMisleading Name" },
    },
    {
      label: "an undersized email fallback",
      email: "x@example.com",
      profile: {},
    },
  ])("rejects $label before creating a user", async ({ email, profile }) => {
    const issuedAt = Math.floor(fixedDate.getTime() / 1000);
    const idTokenPayload = {
      iss: "https://accounts.google.com",
      aud: "test-google-client-id",
      sub: `google-${email}`,
      email,
      email_verified: true,
      iat: issuedAt,
      exp: issuedAt + 3600,
    };
    const idToken = buildGoogleIdToken(idTokenPayload);
    jwtVerifyMock.mockResolvedValueOnce({
      payload: idTokenPayload,
      protectedHeader: { alg: "RS256", typ: "JWT" },
    });
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "access-token",
          token_type: "Bearer",
          scope: "openid email profile",
          expires_in: 3600,
          id_token: idToken,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sub: `google-${email}`,
          email,
          email_verified: true,
          ...profile,
        }),
      });
    prisma.identity.findFirst.mockResolvedValueOnce(null);
    prisma.user.findFirst.mockResolvedValueOnce(null);

    await expect(
      completeGoogleAuthorization(
        { code: "auth-code", state: "state-value" },
        {
          redirectUri: "https://app.example.com/api/v1/auth/google/callback",
          expectedState: "state-value",
          codeVerifier: "a".repeat(64),
          context: { ipAddress: "127.0.0.1", userAgent: "oauth-test" },
        },
      ),
    ).rejects.toMatchObject({
      statusCode: 400,
      message:
        "Google account name does not meet display-name requirements. Update your Google profile and try again.",
    });
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
