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

// Mock env config so we can toggle nodeEnv between test/production.
const mockConfig = { nodeEnv: "test" as string };
vi.mock("../../src/config/env.js", () => ({
  get config() {
    return mockConfig;
  },
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
    mockConfig.nodeEnv = "test";
  });

  it("attaches a header-authenticated actor to req.user and role context (dev/test only)", async () => {
    const req = makeRequest("/courses", {
      "x-user-id": "7f6c9f72-1e95-4f36-8f06-0f0a9ed0b1c2",
      "x-user-role": "teacher",
    });
    const next = vi.fn();

    await rlsContext(req, {} as Response, next as NextFunction);

    expect(req.user).toEqual({
      id: "7f6c9f72-1e95-4f36-8f06-0f0a9ed0b1c2",
      role: "teacher",
      status: "active",
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

  it("falls back to anonymous context for non-active actors", async () => {
    const req = makeRequest("/courses", {
      "x-user-id": "7f6c9f72-1e95-4f36-8f06-0f0a9ed0b1c2",
      "x-user-role": "teacher",
      "x-user-status": "pending",
    });
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
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("ignores header-based auth when NODE_ENV is production", async () => {
    mockConfig.nodeEnv = "production";

    const req = makeRequest("/courses", {
      "x-user-id": "7f6c9f72-1e95-4f36-8f06-0f0a9ed0b1c2",
      "x-user-role": "teacher",
    });
    const next = vi.fn();

    await rlsContext(req, {} as Response, next as NextFunction);

    // Header auth should be ignored in production; no Bearer token present means anonymous.
    expect(req.user).toBeUndefined();
    expect(withRoleContextMock).toHaveBeenCalledWith(
      {
        role: "anon",
        userId: "",
        userRole: "anon",
      },
      expect.any(Function),
    );
    expect(next).toHaveBeenCalledTimes(1);
  });
});
