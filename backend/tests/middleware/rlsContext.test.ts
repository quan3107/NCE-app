/**
 * File: tests/middleware/rlsContext.test.ts
 * Purpose: Verify request actor propagation and role-context setup in RLS middleware.
 * Why: Prevents optional-auth routes from silently behaving like anonymous requests.
 */
import type { NextFunction, Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/prisma/client.js", () => ({
  withRoleContext: vi.fn((_options: unknown, fn: () => void) => fn()),
}));

vi.mock("../../src/modules/auth/auth.tokens.js", () => ({
  verifyAccessToken: vi.fn(),
}));

const prismaModule = await import("../../src/prisma/client.js");
const authTokensModule = await import("../../src/modules/auth/auth.tokens.js");
const { rlsContext } = await import("../../src/middleware/rlsContext.js");

const withRoleContextMock = vi.mocked(prismaModule.withRoleContext);
const verifyAccessTokenMock = vi.mocked(authTokensModule.verifyAccessToken);

function makeRequest(path: string, headers: Record<string, string>): Request {
  return {
    path,
    header(name: string) {
      return headers[name.toLowerCase()] ?? headers[name] ?? undefined;
    },
  } as Request;
}

describe("middleware.rlsContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("attaches a header-authenticated actor to req.user and role context", async () => {
    const req = makeRequest("/courses", {
      "x-user-id": "7f6c9f72-1e95-4f36-8f06-0f0a9ed0b1c2",
      "x-user-role": "teacher",
    });
    const next = vi.fn();

    await rlsContext(req, {} as Response, next as NextFunction);

    expect(req.user).toEqual({
      id: "7f6c9f72-1e95-4f36-8f06-0f0a9ed0b1c2",
      role: "teacher",
    });
    expect(withRoleContextMock).toHaveBeenCalledWith(
      {
        role: "authenticated",
        userId: "7f6c9f72-1e95-4f36-8f06-0f0a9ed0b1c2",
        userRole: "teacher",
      },
      expect.any(Function),
    );
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("falls back to anonymous role context when no actor is present", async () => {
    const req = makeRequest("/courses", {});
    const next = vi.fn();

    await rlsContext(req, {} as Response, next as NextFunction);

    expect(req.user).toBeUndefined();
    expect(withRoleContextMock).toHaveBeenCalledWith(
      {
        role: "anon",
        userId: "",
        userRole: "anon",
      },
      expect.any(Function),
    );
    expect(verifyAccessTokenMock).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });
});
