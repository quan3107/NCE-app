/**
 * Location: tests/authLocalStoragePersistence.component.test.tsx
 * Purpose: Verify rejected shared-storage writes retain reload restoration.
 * Why: A valid refresh cookie must not become unreachable after login succeeds.
 */
import assert from "node:assert/strict";
import type { PropsWithChildren } from "react";

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, test, vi } from "vitest";

import { AuthProvider, useAuth } from "../src/lib/auth";
import { authBridge } from "../src/lib/authBridge";
import { queryClient } from "../src/lib/queryClient";

const originalLocalStorage = Object.getOwnPropertyDescriptor(
  window,
  "localStorage",
);
const originalSessionStorage = Object.getOwnPropertyDescriptor(
  window,
  "sessionStorage",
);
const originalLocks = Object.getOwnPropertyDescriptor(navigator, "locks");

function mapStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => void values.delete(key),
    setItem: (key, value) => void values.set(key, value),
  };
}

beforeEach(() => {
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      ...mapStorage(),
      setItem: () => {
        throw new DOMException("Quota exceeded", "QuotaExceededError");
      },
    },
  });
  Object.defineProperty(window, "sessionStorage", {
    configurable: true,
    value: mapStorage(),
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
  for (const [target, key, descriptor] of [
    [window, "localStorage", originalLocalStorage],
    [window, "sessionStorage", originalSessionStorage],
    [navigator, "locks", originalLocks],
  ] as const) {
    if (descriptor) Object.defineProperty(target, key, descriptor);
    else Reflect.deleteProperty(target, key);
  }
});

test("reload restores a login whose localStorage write was rejected", async () => {
  const user = {
    id: "11111111-1111-4111-8111-111111111111",
    fullName: "Ada Lovelace",
    email: "ada@example.com",
    role: "student" as const,
  };
  const requests: string[] = [];
  const fetchSpy = vi.fn<typeof fetch>(async (input) => {
    const path = new URL(String(input)).pathname;
    requests.push(path);
    if (path.endsWith("/me")) return Response.json({ profile: user });
    return Response.json({
      accessToken: path.endsWith("/auth/login")
        ? "login-token"
        : "refresh-token",
      user,
    });
  });
  vi.stubGlobal("fetch", fetchSpy);
  const wrapper = ({ children }: PropsWithChildren) => (
    <AuthProvider>{children}</AuthProvider>
  );
  const first = renderHook(() => useAuth(), { wrapper });

  await act(async () => {
    assert.equal(
      await first.result.current.login(user.email, "password"),
      "live",
    );
  });
  assert.equal(first.result.current.isAuthenticated, true);
  await waitFor(() => assert.equal(requests.includes("/api/v1/me"), true));
  first.unmount();

  const reloaded = renderHook(() => useAuth(), { wrapper });
  await waitFor(() =>
    assert.equal(reloaded.result.current.isAuthenticated, true),
  );
  assert.equal(
    requests.filter((path) => path.endsWith("/auth/refresh")).length,
    1,
  );
});
