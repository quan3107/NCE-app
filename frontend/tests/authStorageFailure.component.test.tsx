/**
 * Location: tests/authStorageFailure.component.test.tsx
 * Purpose: Verify auth operations survive unavailable browser persistence.
 * Why: Storage failures must not prevent login coordination or server logout.
 */
import assert from "node:assert/strict";
import type { PropsWithChildren } from "react";

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { AuthProvider, useAuth } from "../src/lib/auth";
import { createAuthCookieOperations } from "../src/lib/auth-cookie-operations";
import { authBridge } from "../src/lib/authBridge";
import { queryClient } from "../src/lib/queryClient";

const originalLocalStorageDescriptor = Object.getOwnPropertyDescriptor(
  window,
  "localStorage",
);
const originalLocksDescriptor = Object.getOwnPropertyDescriptor(
  navigator,
  "locks",
);

beforeEach(() => {
  const values = new Map<string, string>();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      clear: () => values.clear(),
      getItem: (key: string) => values.get(key) ?? null,
      removeItem: (key: string) => values.delete(key),
      setItem: (key: string, value: string) => values.set(key, value),
    },
  });
});

afterEach(() => {
  cleanup();
  authBridge.reset();
  queryClient.clear();
  vi.unstubAllGlobals();
  if (originalLocalStorageDescriptor) {
    Object.defineProperty(
      window,
      "localStorage",
      originalLocalStorageDescriptor,
    );
  } else {
    Reflect.deleteProperty(window, "localStorage");
  }
  if (originalLocksDescriptor) {
    Object.defineProperty(navigator, "locks", originalLocksDescriptor);
  } else {
    Reflect.deleteProperty(navigator, "locks");
  }
});

test("fails closed when every cross-tab lock boundary is unavailable", async () => {
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    get() {
      throw new DOMException("Storage denied", "SecurityError");
    },
  });
  Object.defineProperty(navigator, "locks", {
    configurable: true,
    value: undefined,
  });
  const operations = createAuthCookieOperations();

  await expect(operations.run(async () => "complete")).rejects.toMatchObject({
    name: "AuthCoordinationUnavailableError",
  });
});

test("server logout still runs when cleared-session persistence fails", async () => {
  const values = new Map<string, string>();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      clear: () => values.clear(),
      getItem: (key: string) => values.get(key) ?? null,
      removeItem: (key: string) => values.delete(key),
      setItem: () => {
        throw new DOMException("Quota exceeded", "QuotaExceededError");
      },
    },
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
  const fetchSpy = vi.fn(async () => new Response(null, { status: 204 }));
  vi.stubGlobal("fetch", fetchSpy);
  const wrapper = ({ children }: PropsWithChildren) => (
    <AuthProvider>{children}</AuthProvider>
  );
  const view = renderHook(() => useAuth(), { wrapper });

  await act(async () => {
    await view.result.current.logout();
  });

  assert.equal(fetchSpy.mock.calls.length, 1);
  assert.match(String(fetchSpy.mock.calls[0]?.[0]), /\/auth\/logout$/);
  assert.equal(view.result.current.isAuthenticated, false);
});

test("an owned OAuth lease can be released on a terminal cancellation", async () => {
  const operations = createAuthCookieOperations();
  await operations.runOAuthStart(async () => "started");
  assert.notEqual(
    window.localStorage.getItem("nce:auth-cookie-oauth-lease"),
    null,
  );

  operations.releaseOAuthLease();

  assert.equal(
    window.localStorage.getItem("nce:auth-cookie-oauth-lease"),
    null,
  );
});

test("a password fallback releases its tab's abandoned OAuth lease", async () => {
  const operations = createAuthCookieOperations({ operationTimeoutMs: 25 });
  await operations.runOAuthStart(async () => "started");

  await expect(operations.run(async () => "password-login")).resolves.toBe(
    "password-login",
  );
  assert.equal(
    window.localStorage.getItem("nce:auth-cookie-oauth-lease"),
    null,
  );
});
