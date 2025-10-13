/**
 * File: tests/modules/auth/auth.service.test.ts
 * Purpose: Validate the auth service flows for login, refresh rotation, and logout revocation.
 * Why: Ensures credential handling and session management behave as intended before wiring the frontend.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??= "postgres://user:pass@localhost:5432/test-db";
process.env.JWT_PRIVATE_KEY_PATH ??= "tests/fixtures/private.pem";
process.env.JWT_PUBLIC_KEY_PATH ??= "tests/fixtures/public.pem";
process.env.GOOGLE_CLIENT_ID ??= "test-google-client-id";
process.env.GOOGLE_CLIENT_SECRET ??= "test-google-client-secret";

vi.mock("node:crypto", async () => {
  const actual = await vi.importActual<typeof import("node:crypto")>(
    "node:crypto",
  );
  const randomBytesMock = vi.fn((size?: number) =>
    Buffer.alloc(size ?? 48, 1),
  );
  return {
    ...actual,
    randomBytes: randomBytesMock,
  };
});

vi.mock("../../../src/config/prismaClient.js", () => {
  const user = { findFirst: vi.fn(), create: vi.fn() };
  const identity = { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() };
  const authSession = {
    create: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  };
  const prisma = {
    user,
    identity,
    authSession,
    $transaction: vi.fn(async (callback: (tx: {
      user: typeof user;
      identity: typeof identity;
    }) => Promise<unknown>) =>
      callback({
        user: {
          create: user.create,
        },
        identity: {
          create: identity.create,
        },
      } as unknown as {
        user: typeof user;
        identity: typeof identity;
      }),
    ),
  };
  return {
    prisma,
  };
});

vi.mock("bcrypt", () => {
  const compare = vi.fn();
  const hash = vi.fn();
  return {
    default: {
      compare,
      hash,
    },
    compare,
    hash,
  };
});

vi.mock("../../../src/modules/auth/auth.tokens.js", () => ({
  signAccessToken: vi.fn(),
}));

const fetchMock = vi.fn();
(globalThis as unknown as { fetch: typeof fetch }).fetch =
  fetchMock as unknown as typeof fetch;

const crypto = await import("node:crypto");
const prisma = await import("../../../src/config/prismaClient.js").then(
  (module) => module.prisma,
);
const bcrypt = await import("bcrypt").then((module) => module.default);
const { signAccessToken } = await import(
  "../../../src/modules/auth/auth.tokens.js"
);

const {
  handleRegisterAccount,
  handlePasswordLogin,
  handleSessionRefresh,
  handleLogout,
  REFRESH_TOKEN_TTL_MS,
  buildGoogleAuthorizationUrl,
  completeGoogleAuthorization,
} = await import("../../../src/modules/auth/auth.service.js");

const fixedDate = new Date("2025-10-11T12:00:00.000Z");
const randomBytesMock = crypto.randomBytes as unknown as vi.Mock;

describe("auth.service", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(fixedDate);
    fetchMock.mockReset();
    randomBytesMock.mockImplementation((size?: number) =>
      Buffer.alloc(size ?? 48, 1),
    );
    (signAccessToken as unknown as vi.Mock).mockReturnValue("signed-access");
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  const ipHash = (value: string) =>
    crypto.createHash("sha256").update(value).digest("hex");

  it("registers a new user and returns auth tokens", async () => {
    prisma.user.findFirst.mockResolvedValueOnce(null);
    (bcrypt.hash as unknown as vi.Mock).mockResolvedValueOnce("hashed-password");
    prisma.user.create.mockResolvedValueOnce({
      id: "user-1",
      email: "new.user@example.com",
      fullName: "New User",
      role: "admin",
    });
    prisma.authSession.create.mockResolvedValueOnce(undefined);
    randomBytesMock.mockReturnValueOnce(Buffer.alloc(48, 3));

    const result = await handleRegisterAccount(
      {
        fullName: "  New User  ",
        email: "New.User@example.com",
        password: "Passw0rd!",
        role: "admin",
      },
      { ipAddress: "192.168.0.2", userAgent: "vitest-register" },
    );

    expect(bcrypt.hash).toHaveBeenCalledWith("Passw0rd!", 12);
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: {
        email: "new.user@example.com",
        fullName: "New User",
        password: "hashed-password",
        role: "admin",
        status: "active",
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
      },
    });

    expect(result.user).toEqual({
      id: "user-1",
      email: "new.user@example.com",
      fullName: "New User",
      role: "admin",
    });
    expect(result.accessToken).toBe("signed-access");
    expect(result.refreshToken).toBe(Buffer.alloc(48, 3).toString("base64url"));
    expect(result.refreshTokenExpiresAt.toISOString()).toBe(
      new Date(fixedDate.getTime() + REFRESH_TOKEN_TTL_MS).toISOString(),
    );

    const sessionArgs = prisma.authSession.create.mock.calls[0]?.[0];
    expect(sessionArgs?.data.userId).toBe("user-1");
    expect(sessionArgs?.data.userAgent).toBe("vitest-register");
    expect(sessionArgs?.data.ipHash).toBe(ipHash("192.168.0.2"));
  });

  it("rejects registration when the email is already in use", async () => {
    prisma.user.findFirst.mockResolvedValueOnce({
      id: "existing-user",
    });

    await expect(
      handleRegisterAccount(
        {
          fullName: "Existing User",
          email: "existing@example.com",
          password: "Passw0rd!",
          role: "admin",
        },
        {},
      ),
    ).rejects.toMatchObject({
      statusCode: 409,
    });

    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("issues tokens and persists a session on successful password login", async () => {
    const mockUser = {
      id: "user-1",
      email: "alice@example.com",
      fullName: "Alice Doe",
      role: "student",
      status: "active",
      password: "$2b$10$hash",
    };

    prisma.user.findFirst.mockResolvedValueOnce(mockUser);
    prisma.authSession.create.mockResolvedValueOnce(undefined);
    bcrypt.compare.mockResolvedValueOnce(true);

    const result = await handlePasswordLogin(
      { email: mockUser.email, password: "Passw0rd!" },
      { ipAddress: "127.0.0.1", userAgent: "vitest" },
    );

    expect(result).toMatchObject({
      accessToken: "signed-access",
      user: {
        id: mockUser.id,
        email: mockUser.email,
        fullName: mockUser.fullName,
        role: mockUser.role,
      },
    });

    expect(result.refreshToken).toBeTruthy();
    expect(result.refreshTokenExpiresAt.toISOString()).toBe(
      new Date(fixedDate.getTime() + REFRESH_TOKEN_TTL_MS).toISOString(),
    );

    expect(prisma.authSession.create).toHaveBeenCalledTimes(1);
    const createArgs = prisma.authSession.create.mock.calls[0]?.[0];
    expect(createArgs?.data.userId).toBe(mockUser.id);
    expect(createArgs?.data.ipHash).toBe(ipHash("127.0.0.1"));
    expect(createArgs?.data.userAgent).toBe("vitest");
    expect(createArgs?.data.expiresAt).toEqual(
      new Date(fixedDate.getTime() + REFRESH_TOKEN_TTL_MS),
    );

    const expectedTokenHash = crypto
      .createHash("sha256")
      .update(result.refreshToken)
      .digest("hex");
    expect(createArgs?.data.refreshTokenHash).toBe(expectedTokenHash);
  });

  it("rejects login when the password comparison fails", async () => {
    prisma.user.findFirst.mockResolvedValueOnce({
      id: "user-1",
      email: "alice@example.com",
      fullName: "Alice Doe",
      role: "student",
      status: "active",
      password: "$2b$10$hash",
    });
    bcrypt.compare.mockResolvedValueOnce(false);

    await expect(
      handlePasswordLogin(
        { email: "alice@example.com", password: "wrongpass" },
        {},
      ),
    ).rejects.toMatchObject({ statusCode: 401 });

    expect(prisma.authSession.create).not.toHaveBeenCalled();
  });

  it("rotates sessions and returns a new refresh token during refresh", async () => {
    const existingToken = "existing-refresh";
    const nextTokenBuffer = Buffer.alloc(48, 2);
    randomBytesMock.mockReturnValueOnce(nextTokenBuffer);

    prisma.authSession.findFirst.mockResolvedValueOnce({
      id: "session-1",
      userId: "user-1",
    });
    prisma.user.findFirst.mockResolvedValueOnce({
      id: "user-1",
      email: "alice@example.com",
      fullName: "Alice Doe",
      role: "teacher",
      status: "active",
      password: "$2b$10$hash",
    });
    prisma.authSession.update.mockResolvedValueOnce(undefined);

    const result = await handleSessionRefresh(
      {},
      { refreshToken: existingToken, userAgent: "vitest-refresh" },
    );

    expect(result.accessToken).toBe("signed-access");
    expect(result.refreshToken).toBe(
      nextTokenBuffer.toString("base64url"),
    );

    expect(prisma.authSession.update).toHaveBeenCalledTimes(1);
    const updateArgs = prisma.authSession.update.mock.calls[0]?.[0];
    expect(updateArgs?.where.id).toBe("session-1");
    expect(updateArgs?.data.userAgent).toBe("vitest-refresh");
    expect(updateArgs?.data.refreshTokenHash).toBe(
      crypto
        .createHash("sha256")
        .update(result.refreshToken)
        .digest("hex"),
    );
  });

  it("revokes matching sessions on logout when a token is present", async () => {
    prisma.authSession.updateMany.mockResolvedValueOnce({ count: 1 });

    await handleLogout({}, { refreshToken: "to-revoke" });

    expect(prisma.authSession.updateMany).toHaveBeenCalledWith({
      where: {
        refreshTokenHash: crypto
          .createHash("sha256")
          .update("to-revoke")
          .digest("hex"),
        revokedAt: null,
      },
      data: {
        revokedAt: expect.any(Date),
      },
    });
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
    const state = "state-value";
    const codeVerifier = "a".repeat(64);

    const idTokenPayload = {
      iss: "https://accounts.google.com",
      aud: "test-google-client-id",
      sub: "google-123",
      email: "existing@example.com",
      email_verified: true,
    };
    const idToken = [
      Buffer.from(
        JSON.stringify({ alg: "RS256", typ: "JWT" }),
      ).toString("base64url"),
      Buffer.from(JSON.stringify(idTokenPayload)).toString("base64url"),
      "signature",
    ].join(".");

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

    prisma.identity.findFirst.mockResolvedValueOnce({
      id: "identity-1",
      emailVerified: false,
      user: {
        id: "user-1",
        email: "existing@example.com",
        fullName: "Existing User",
        role: "teacher",
        status: "active",
      },
    });
    prisma.identity.update.mockResolvedValueOnce({});
    prisma.authSession.create.mockResolvedValueOnce(undefined);

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
      expect.objectContaining({
        method: "POST",
      }),
    );
    const tokenCall = fetchMock.mock.calls[0]?.[1];
    expect(tokenCall?.body).toContain("code=auth-code");
    expect(tokenCall?.body).toContain(`code_verifier=${codeVerifier}`);

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
  });
});
