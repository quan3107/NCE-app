/**
 * File: tests/modules/auth/auth.service.test-utils.ts
 * Purpose: Share auth service mocks, builders, and imports across auth tests.
 * Why: Keeps split auth test files small without duplicating fragile mock setup.
 */
import { vi, type Mock, type MockedFunction } from "vitest";
import type { AuthSession, Identity, User } from "../../../src/prisma/index.js";
import {
  IdentityProvider,
  UserRole,
  UserStatus,
} from "../../../src/prisma/index.js";

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
    $transaction: vi.fn(async (callback) =>
      callback({
        user: { create: user.create },
        identity: { create: identity.create },
      }),
    ),
  };
  return { prisma };
});

vi.mock("../../../src/prisma/client.js", () => ({
  runWithRole: vi.fn(async (_options, fn: (tx: unknown) => Promise<unknown>) =>
    fn({}),
  ),
}));

vi.mock("bcrypt", () => {
  const compare = vi.fn();
  const hash = vi.fn();
  return {
    default: { compare, hash },
    compare,
    hash,
  };
});

vi.mock("../../../src/modules/auth/auth.tokens.js", () => ({
  signAccessToken: vi.fn(),
}));

export const fetchMock = vi.fn();
(globalThis as unknown as { fetch: typeof fetch }).fetch =
  fetchMock as unknown as typeof fetch;

export const crypto = await import("node:crypto");
const prismaModule = await import("../../../src/config/prismaClient.js");
export const prisma = vi.mocked(prismaModule.prisma, true);
const bcryptModule = await import("bcrypt");
export const bcrypt = vi.mocked(bcryptModule.default, true);
const tokensModule = vi.mocked(
  await import("../../../src/modules/auth/auth.tokens.js"),
);
export const { signAccessToken } = tokensModule;
export const bcryptHashMock = bcrypt.hash as unknown as MockedFunction<
  (data: string | Buffer, rounds: string | number) => Promise<string>
>;
export const bcryptCompareMock = bcrypt.compare as unknown as MockedFunction<
  (data: string | Buffer, encrypted: string | Buffer) => Promise<boolean>
>;

export const {
  resetAuthRateLimiter,
  handleRegisterAccount,
  handlePasswordLogin,
  handleSessionRefresh,
  handleLogout,
  REFRESH_TOKEN_TTL_MS,
  buildGoogleAuthorizationUrl,
  completeGoogleAuthorization,
} = await import("../../../src/modules/auth/auth.service.js");

export const fixedDate = new Date("2025-10-11T12:00:00.000Z");
export const randomBytesMock = crypto.randomBytes as unknown as Mock;

export const ipHash = (value: string) =>
  crypto.createHash("sha256").update(value).digest("hex");

export function resetAuthServiceMocks(): void {
  fetchMock.mockReset();
  resetAuthRateLimiter();
  randomBytesMock.mockImplementation((size?: number) =>
    Buffer.alloc(size ?? 48, 1),
  );
  signAccessToken.mockReturnValue("signed-access");
}

export const buildUser = (overrides: Partial<User> = {}): User => ({
  id: "user-default",
  email: "user@example.com",
  password: "$2b$10$hash",
  fullName: "Default User",
  role: UserRole.teacher,
  status: UserStatus.active,
  createdAt: new Date(fixedDate),
  updatedAt: new Date(fixedDate),
  deletedAt: null,
  ...overrides,
});

export const buildAuthSession = (
  overrides: Partial<AuthSession> = {},
): AuthSession => ({
  id: overrides.id ?? "session-default",
  userId: overrides.userId ?? "user-default",
  refreshTokenHash: overrides.refreshTokenHash ?? "refresh-token-hash",
  userAgent: overrides.userAgent ?? null,
  ipHash: overrides.ipHash ?? null,
  expiresAt: overrides.expiresAt ?? new Date(fixedDate),
  revokedAt: overrides.revokedAt ?? null,
  createdAt: overrides.createdAt ?? new Date(fixedDate),
  updatedAt: overrides.updatedAt ?? new Date(fixedDate),
  deletedAt: overrides.deletedAt ?? null,
});

export const buildIdentity = (
  overrides: Partial<Identity> = {},
  userOverrides: Partial<User> = {},
): Identity & { user: User } => {
  const userId = overrides.userId ?? userOverrides.id ?? "user-identity";
  return {
    id: overrides.id ?? "identity-default",
    userId,
    provider: overrides.provider ?? IdentityProvider.google,
    providerSubject: overrides.providerSubject ?? "google-subject",
    providerIssuer: overrides.providerIssuer ?? "https://accounts.google.com",
    email: overrides.email ?? "identity@example.com",
    emailVerified: overrides.emailVerified ?? false,
    createdAt: overrides.createdAt ?? new Date(fixedDate),
    updatedAt: overrides.updatedAt ?? new Date(fixedDate),
    deletedAt: overrides.deletedAt ?? null,
    user: buildUser({ id: userId, ...userOverrides }),
  };
};
