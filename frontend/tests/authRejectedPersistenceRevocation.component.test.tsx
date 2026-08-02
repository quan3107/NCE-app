/**
 * Location: tests/authRejectedPersistenceRevocation.component.test.tsx
 * Purpose: Verify a rejected live login revokes its server cookie before returning.
 * Why: A hidden refresh cookie must not survive browser persistence failure.
 */
import assert from "node:assert/strict";
import type { PropsWithChildren } from "react";

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, test, vi } from "vitest";

import { AuthProvider, useAuth } from "../src/lib/auth";
import { authBridge } from "../src/lib/authBridge";
import { queryClient } from "../src/lib/queryClient";

const rejectedStorage = {
  clear: () => undefined,
  getItem: () => null,
  removeItem: () => undefined,
  setItem: () => {
    throw new DOMException("Storage write denied", "QuotaExceededError");
  },
};

beforeEach(() => {
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: rejectedStorage,
  });
  Object.defineProperty(window, "sessionStorage", {
    configurable: true,
    value: rejectedStorage,
  });
  Object.defineProperty(navigator, "locks", {
    configurable: true,
    value: {
      request: async (
        _name: string,
        _options: LockOptions,
        callback: () => Promise<unknown>,
      ) => callback(),
    },
  });
});

afterEach(() => {
  cleanup();
  authBridge.reset();
  queryClient.clear();
  vi.unstubAllGlobals();
});

test("a login rejected by both stores revokes its refresh cookie", async () => {
  const requests: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const path = new URL(String(input)).pathname;
      requests.push(path);
      if (path.endsWith("/auth/login")) {
        return Response.json({
          accessToken: "hidden-token",
          user: {
            id: "user-a",
            email: "user-a@example.com",
            fullName: "User A",
            role: "student",
          },
        });
      }
      if (path.endsWith("/auth/logout")) {
        return new Response(null, { status: 204 });
      }
      throw new Error(`Unexpected request: ${path}`);
    }),
  );
  const wrapper = ({ children }: PropsWithChildren) => (
    <AuthProvider>{children}</AuthProvider>
  );
  const view = renderHook(() => useAuth(), { wrapper });

  let result: "live" | null = "live";
  await act(async () => {
    result = await view.result.current.login("user-a@example.com", "password");
  });

  assert.equal(result, null);
  assert.equal(view.result.current.isAuthenticated, false);
  assert.deepEqual(requests, ["/api/v1/auth/login", "/api/v1/auth/logout"]);
});
