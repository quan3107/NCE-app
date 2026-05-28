/**
 * File: tests/modules/auth/auth.cookies.test.ts
 * Purpose: Verify auth cookie parsing behavior at duplicate-cookie boundaries.
 * Why: Browser refresh requests can include path-specific and legacy refresh cookies together.
 */

import { describe, expect, it } from "vitest";
import type { Request } from "express";

import { readCookie, REFRESH_COOKIE_NAME } from "../../../src/modules/auth/auth.cookies.js";

const requestWithCookie = (cookie: string) =>
  ({
    headers: {
      cookie,
    },
  }) as Request;

describe("auth.cookies", () => {
  it("prefers the first matching refresh cookie when duplicate cookie names are present", () => {
    const req = requestWithCookie(
      `${REFRESH_COOKIE_NAME}=path-specific; theme=dark; ${REFRESH_COOKIE_NAME}=legacy-stale`,
    );

    expect(readCookie(req, REFRESH_COOKIE_NAME)).toBe("path-specific");
  });
});
