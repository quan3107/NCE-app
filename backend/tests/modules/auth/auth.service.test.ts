/**
 * File: tests/modules/auth/auth.service.test.ts
 * Purpose: Validate the auth service flows for login, refresh rotation, and logout revocation.
 * Why: Ensures credential handling and session management behave as intended before wiring the frontend.
 */
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { UserRole } from "../../../src/prisma/index.js";
import {
  bcrypt,
  bcryptCompareMock,
  bcryptHashMock,
  buildAuthSession,
  buildUser,
  crypto,
  fixedDate,
  handleLogout,
  handlePasswordLogin,
  handleRegisterAccount,
  handleSessionRefresh,
  ipHash,
  prisma,
  randomBytesMock,
  REFRESH_TOKEN_TTL_MS,
  resetAuthServiceMocks,
} from "./auth.service.test-utils.js";

describe("auth.service", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(fixedDate);
    resetAuthServiceMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("registers a new user and returns auth tokens", async () => {
    prisma.user.findFirst.mockResolvedValueOnce(null);
    bcryptHashMock.mockResolvedValueOnce("hashed-password");
    prisma.user.create.mockResolvedValueOnce(
      buildUser({
        id: "user-1",
        email: "new.user@example.com",
        fullName: "New User",
        role: UserRole.teacher,
      }),
    );
    prisma.authSession.create.mockResolvedValueOnce(
      buildAuthSession({ id: "session-register", userId: "user-1" }),
    );
    randomBytesMock.mockReturnValueOnce(Buffer.alloc(48, 3));

    const result = await handleRegisterAccount(
      {
        fullName: "  New User  ",
        email: "New.User@example.com",
        password: "Passw0rd!",
        role: "teacher",
      },
      { ipAddress: "192.168.0.2", userAgent: "vitest-register" },
    );

    expect(bcrypt.hash).toHaveBeenCalledWith("Passw0rd!", 12);
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: {
        email: "new.user@example.com",
        fullName: "New User",
        password: "hashed-password",
        role: "teacher",
        status: "active",
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        status: true,
      },
    });

    expect(result.user).toEqual({
      id: "user-1",
      email: "new.user@example.com",
      fullName: "New User",
      role: "teacher",
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

  it("rejects public registration for admin accounts", async () => {
    await expect(
      handleRegisterAccount(
        {
          fullName: "Admin User",
          email: "admin@example.com",
          password: "Passw0rd!",
          role: "admin",
        },
        {},
      ),
    ).rejects.toThrow();

    expect(bcrypt.hash).not.toHaveBeenCalled();
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(prisma.authSession.create).not.toHaveBeenCalled();
  });

  it("rejects registration when the email is already in use", async () => {
    prisma.user.findFirst.mockResolvedValueOnce(
      buildUser({ id: "existing-user" }),
    );

    await expect(
      handleRegisterAccount(
        {
          fullName: "Existing User",
          email: "existing@example.com",
          password: "Passw0rd!",
          role: "teacher",
        },
        {},
      ),
    ).rejects.toMatchObject({
      statusCode: 409,
    });

    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("issues tokens and persists a session on successful password login", async () => {
    const mockUser = buildUser({
      id: "user-1",
      email: "alice@example.com",
      fullName: "Alice Doe",
      role: UserRole.student,
    });

    prisma.user.findFirst
      .mockResolvedValueOnce(mockUser)
      .mockResolvedValueOnce(mockUser);
    prisma.authSession.create.mockResolvedValueOnce(
      buildAuthSession({ id: "session-login", userId: mockUser.id }),
    );
    bcryptCompareMock.mockResolvedValueOnce(true);

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
    prisma.user.findFirst.mockResolvedValueOnce(
      buildUser({
        id: "user-1",
        email: "alice@example.com",
        fullName: "Alice Doe",
        role: UserRole.student,
      }),
    );
    bcryptCompareMock.mockResolvedValueOnce(false);

    await expect(
      handlePasswordLogin(
        { email: "alice@example.com", password: "wrongpass" },
        {},
      ),
    ).rejects.toMatchObject({ statusCode: 401 });

    expect(prisma.authSession.create).not.toHaveBeenCalled();
  });

  it("locks password login after repeated failed attempts and releases it after lockout expires", async () => {
    const mockUser = buildUser({
      id: "user-1",
      email: "alice@example.com",
      fullName: "Alice Doe",
      role: UserRole.student,
    });

    for (let attempt = 0; attempt < 3; attempt += 1) {
      prisma.user.findFirst.mockResolvedValueOnce(mockUser);
      bcryptCompareMock.mockResolvedValueOnce(false);

      await expect(
        handlePasswordLogin(
          { email: "Alice@example.com", password: "wrongpass" },
          { ipAddress: "198.51.100.50" },
        ),
      ).rejects.toMatchObject({ statusCode: 401 });
    }

    await expect(
      handlePasswordLogin(
        { email: "alice@example.com", password: "wrongpass" },
        { ipAddress: "198.51.100.50" },
      ),
    ).rejects.toMatchObject({
      statusCode: 429,
      details: {
        code: "AUTH_RATE_LIMITED",
        retryAfterSeconds: 60,
      },
    });

    expect(prisma.authSession.create).not.toHaveBeenCalled();

    vi.advanceTimersByTime(60_000);
    prisma.user.findFirst
      .mockResolvedValueOnce(mockUser)
      .mockResolvedValueOnce(mockUser);
    prisma.authSession.create.mockResolvedValueOnce(
      buildAuthSession({ id: "session-login", userId: mockUser.id }),
    );
    bcryptCompareMock.mockResolvedValueOnce(true);

    await expect(
      handlePasswordLogin(
        { email: "alice@example.com", password: "Passw0rd!" },
        { ipAddress: "198.51.100.50" },
      ),
    ).resolves.toMatchObject({
      user: {
        id: mockUser.id,
        email: mockUser.email,
      },
    });
  });

  it("clears the account failure counter after a successful password login", async () => {
    const mockUser = buildUser({
      id: "user-1",
      email: "alice@example.com",
      fullName: "Alice Doe",
      role: UserRole.student,
    });

    for (let attempt = 0; attempt < 2; attempt += 1) {
      prisma.user.findFirst.mockResolvedValueOnce(mockUser);
      bcryptCompareMock.mockResolvedValueOnce(false);

      await expect(
        handlePasswordLogin(
          { email: "alice@example.com", password: "wrongpass" },
          { ipAddress: `198.51.100.${attempt + 1}` },
        ),
      ).rejects.toMatchObject({ statusCode: 401 });
    }

    prisma.user.findFirst
      .mockResolvedValueOnce(mockUser)
      .mockResolvedValueOnce(mockUser);
    prisma.authSession.create.mockResolvedValueOnce(
      buildAuthSession({ id: "session-login", userId: mockUser.id }),
    );
    bcryptCompareMock.mockResolvedValueOnce(true);

    await expect(
      handlePasswordLogin(
        { email: "alice@example.com", password: "Passw0rd!" },
        { ipAddress: "198.51.100.20" },
      ),
    ).resolves.toMatchObject({
      user: {
        id: mockUser.id,
        email: mockUser.email,
      },
    });

    prisma.user.findFirst.mockResolvedValueOnce(mockUser);
    bcryptCompareMock.mockResolvedValueOnce(false);

    await expect(
      handlePasswordLogin(
        { email: "alice@example.com", password: "wrongpass" },
        { ipAddress: "198.51.100.30" },
      ),
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  it("rotates sessions and returns a new refresh token during refresh", async () => {
    const existingToken = "existing-refresh";
    const nextTokenBuffer = Buffer.alloc(48, 2);
    randomBytesMock.mockReturnValueOnce(nextTokenBuffer);

    const activeSession = {
      ...buildAuthSession({ id: "session-1", userId: "user-1" }),
      familyId: "family-1",
      replacedAt: null,
      reuseDetectedAt: null,
    };
    prisma.authSession.findFirst.mockResolvedValueOnce(activeSession);
    prisma.user.findFirst.mockResolvedValueOnce(
      buildUser({
        id: "user-1",
        email: "alice@example.com",
        fullName: "Alice Doe",
        role: UserRole.teacher,
      }),
    );
    prisma.authSession.updateMany.mockResolvedValueOnce({ count: 1 });

    const result = await handleSessionRefresh(
      {},
      { refreshToken: existingToken, userAgent: "vitest-refresh" },
    );

    expect(result.accessToken).toBe("signed-access");
    expect(result.refreshToken).toBe(
      nextTokenBuffer.toString("base64url"),
    );

    expect(prisma.authSession.updateMany).toHaveBeenCalledTimes(1);
    const updateArgs = prisma.authSession.updateMany.mock.calls[0]?.[0];
    expect(updateArgs?.where).toEqual({
      id: "session-1",
      revokedAt: null,
      replacedAt: null,
    });
    expect(updateArgs?.data.replacedAt).toEqual(fixedDate);

    expect(prisma.authSession.create).toHaveBeenCalledTimes(1);
    const createArgs = prisma.authSession.create.mock.calls[0]?.[0];
    expect(createArgs?.data.userId).toBe("user-1");
    expect(createArgs?.data.familyId).toBe("family-1");
    expect(createArgs?.data.rotatedFromId).toBe("session-1");
    expect(createArgs?.data.userAgent).toBe("vitest-refresh");
    expect(createArgs?.data.refreshTokenHash).toBe(
      crypto
        .createHash("sha256")
        .update(result.refreshToken)
        .digest("hex"),
    );
  });

  it("refreshes sessions for passwordless SSO users", async () => {
    const existingToken = "google-refresh";
    const nextTokenBuffer = Buffer.alloc(48, 3);
    randomBytesMock.mockReturnValueOnce(nextTokenBuffer);

    const activeSession = {
      ...buildAuthSession({ id: "session-google", userId: "user-google" }),
      familyId: "family-google",
      replacedAt: null,
      reuseDetectedAt: null,
    };
    prisma.authSession.findFirst.mockResolvedValueOnce(activeSession);
    prisma.user.findFirst.mockResolvedValueOnce(
      buildUser({
        id: "user-google",
        email: "sso@example.com",
        fullName: "SSO User",
        role: UserRole.teacher,
        password: null,
      }),
    );
    prisma.authSession.updateMany.mockResolvedValueOnce({ count: 1 });

    const result = await handleSessionRefresh(
      {},
      { refreshToken: existingToken, userAgent: "oauth-refresh" },
    );

    expect(result.accessToken).toBe("signed-access");
    expect(result.user).toEqual({
      id: "user-google",
      email: "sso@example.com",
      fullName: "SSO User",
      role: "teacher",
    });
    expect(result.refreshToken).toBe(
      nextTokenBuffer.toString("base64url"),
    );
    expect(prisma.authSession.updateMany).toHaveBeenCalledTimes(1);
    const updateArgs = prisma.authSession.updateMany.mock.calls[0]?.[0];
    expect(updateArgs?.where).toEqual({
      id: "session-google",
      revokedAt: null,
      replacedAt: null,
    });
    expect(updateArgs?.data.replacedAt).toEqual(fixedDate);

    expect(prisma.authSession.create).toHaveBeenCalledTimes(1);
    const createArgs = prisma.authSession.create.mock.calls[0]?.[0];
    expect(createArgs?.data.userId).toBe("user-google");
    expect(createArgs?.data.familyId).toBe("family-google");
    expect(createArgs?.data.rotatedFromId).toBe("session-google");
    expect(createArgs?.data.userAgent).toBe("oauth-refresh");
  });

  it("revokes the compromised session family when a rotated token is reused", async () => {
    const reusedTokenHash = crypto
      .createHash("sha256")
      .update("old-refresh")
      .digest("hex");
    const replacedSession = {
      ...buildAuthSession({
        id: "session-old",
        userId: "user-1",
        refreshTokenHash: reusedTokenHash,
      }),
      familyId: "family-1",
      replacedAt: fixedDate,
      reuseDetectedAt: null,
    };

    prisma.authSession.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(replacedSession);
    prisma.authSession.updateMany.mockResolvedValueOnce({ count: 2 });

    await expect(
      handleSessionRefresh({}, { refreshToken: "old-refresh" }),
    ).rejects.toMatchObject({ statusCode: 401 });

    expect(prisma.authSession.updateMany).toHaveBeenCalledWith({
      where: {
        familyId: "family-1",
        revokedAt: null,
      },
      data: {
        revokedAt: fixedDate,
        reuseDetectedAt: fixedDate,
      },
    });
    expect(prisma.authSession.create).not.toHaveBeenCalled();
  });

  it("revokes the session family when a concurrent refresh loses the token claim", async () => {
    const activeSession = {
      ...buildAuthSession({ id: "session-race", userId: "user-1" }),
      familyId: "family-race",
      replacedAt: null,
      reuseDetectedAt: null,
    };

    prisma.authSession.findFirst.mockResolvedValueOnce(activeSession);
    prisma.user.findFirst.mockResolvedValueOnce(
      buildUser({
        id: "user-1",
        email: "alice@example.com",
        fullName: "Alice Doe",
        role: UserRole.teacher,
      }),
    );
    prisma.authSession.updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 2 });

    await expect(
      handleSessionRefresh({}, { refreshToken: "raced-refresh" }),
    ).rejects.toMatchObject({ statusCode: 401 });

    expect(prisma.authSession.updateMany).toHaveBeenNthCalledWith(1, {
      where: {
        id: "session-race",
        revokedAt: null,
        replacedAt: null,
      },
      data: {
        replacedAt: fixedDate,
      },
    });
    expect(prisma.authSession.updateMany).toHaveBeenNthCalledWith(2, {
      where: {
        familyId: "family-race",
        revokedAt: null,
      },
      data: {
        revokedAt: fixedDate,
        reuseDetectedAt: fixedDate,
      },
    });
    expect(prisma.authSession.create).not.toHaveBeenCalled();
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

});
