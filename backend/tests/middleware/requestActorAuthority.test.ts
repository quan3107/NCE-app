/**
 * File: tests/middleware/requestActorAuthority.test.ts
 * Purpose: Verify bearer actors remain bound to live server-side authority.
 * Why: Browser storage failures must not preserve logged-out or stale-role access.
 */
import type { Request } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

const findFirst = vi.fn();
const verifyAccessToken = vi.fn();

vi.mock("../../src/config/prismaClient.js", () => ({
  prisma: { authSession: { findFirst } },
}));
vi.mock("../../src/prisma/client.js", () => ({
  runWithRole: vi.fn(async (_context, operation) => operation()),
}));
vi.mock("../../src/modules/auth/auth.tokens.js", () => ({
  verifyAccessToken,
}));
vi.mock("../../src/config/env.js", () => ({
  config: { nodeEnv: "production" },
}));

const { resolveAuthoritativeRequestActor } = await import(
  "../../src/middleware/requestActor.js"
);

const requestWithBearer = (token = "access-token") =>
  ({
    header: (name: string) =>
      name.toLowerCase() === "authorization" ? `Bearer ${token}` : undefined,
  }) as Request;

describe("request actor server authority", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    verifyAccessToken.mockReturnValue({
      sub: "55555555-5555-4555-8555-555555555555",
      role: "teacher",
      status: "active",
      sid: "66666666-6666-4666-8666-666666666666",
    });
  });

  it("rejects an access token after its session family is revoked", async () => {
    findFirst.mockResolvedValue(null);

    await expect(
      resolveAuthoritativeRequestActor(requestWithBearer()),
    ).resolves.toEqual({ kind: "invalid" });
  });

  it.each(["role", "status"])(
    "rejects an access token after its user %s changes",
    async () => {
      // The authority query includes both claims; either mismatch returns no
      // authoritative family row and invalidates the previously signed token.
      findFirst.mockResolvedValue(null);

      await expect(
        resolveAuthoritativeRequestActor(requestWithBearer()),
      ).resolves.toEqual({ kind: "invalid" });
    },
  );

  it("admits only a family whose user still has the token role and status", async () => {
    findFirst.mockResolvedValue({ id: "active-session" });

    await expect(
      resolveAuthoritativeRequestActor(requestWithBearer()),
    ).resolves.toMatchObject({
      kind: "authenticated",
      actor: {
        id: "55555555-5555-4555-8555-555555555555",
        role: "teacher",
      },
    });
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        familyId: "66666666-6666-4666-8666-666666666666",
        userId: "55555555-5555-4555-8555-555555555555",
        revokedAt: null,
        replacedAt: null,
        deletedAt: null,
        expiresAt: { gt: expect.any(Date) },
        user: {
          deletedAt: null,
          role: "teacher",
          status: "active",
        },
      },
      select: { id: true },
    });
  });
});
