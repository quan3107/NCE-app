/**
 * File: tests/middleware/roleGuard.test.ts
 * Purpose: Validate role and status gates for protected routes.
 * Why: Prevents pending teacher accounts from using teacher-only APIs.
 */
import { describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";

import { roleGuard } from "../../src/middleware/roleGuard.js";
import { UserRole, UserStatus } from "../../src/prisma/index.js";

function mockResponse() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  };
  return res as unknown as Response & typeof res;
}

describe("roleGuard", () => {
  it("allows active users with required roles", () => {
    const req = {
      user: {
        id: "7f6c9f72-1e95-4f36-8f06-0f0a9ed0b1c2",
        role: UserRole.teacher,
        status: UserStatus.active,
      },
    } as Request;
    const res = mockResponse();
    const next = vi.fn() as NextFunction;

    roleGuard([UserRole.teacher])(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it.each([UserStatus.pending, UserStatus.suspended])(
    "forbids %s users even when their role matches",
    (status) => {
      const req = {
        user: {
          id: "7f6c9f72-1e95-4f36-8f06-0f0a9ed0b1c2",
          role: UserRole.teacher,
          status,
        },
      } as Request;
      const res = mockResponse();
      const next = vi.fn() as NextFunction;

      roleGuard([UserRole.teacher])(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: "Forbidden" });
    },
  );
});
