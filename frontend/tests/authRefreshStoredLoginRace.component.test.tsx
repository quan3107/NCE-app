/**
 * Location: tests/authRefreshStoredLoginRace.component.test.tsx
 * Purpose: Verify an older failed refresh cannot clear a newer stored login.
 * Why: Storage can advance before the browser delivers its cross-tab event.
 */
import assert from "node:assert/strict";
import type { PropsWithChildren } from "react";

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, test, vi } from "vitest";

import { AuthProvider, useAuth } from "../src/lib/auth";
import { authBridge } from "../src/lib/authBridge";
import { queryClient } from "../src/lib/queryClient";

beforeEach(() => {
  for (const storageName of ["localStorage", "sessionStorage"] as const) {
    const values = new Map<string, string>();
    Object.defineProperty(window, storageName, {
      configurable: true,
      value: {
        clear: () => values.clear(),
        getItem: (key: string) => values.get(key) ?? null,
        removeItem: (key: string) => values.delete(key),
        setItem: (key: string, value: string) => values.set(key, value),
      },
    });
  }
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

test("a refresh rejection adopts a newer stored account before clearing", async () => {
  let rejectRefresh!: (error: Error) => void;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const path = new URL(String(input)).pathname;
      if (path.endsWith("/auth/login")) {
        return Response.json({
          accessToken: "token-a",
          user: {
            id: "user-a",
            email: "user-a@example.com",
            fullName: "User A",
            role: "student",
          },
        });
      }
      if (path.endsWith("/auth/refresh")) {
        return new Promise<Response>((_resolve, reject) => {
          rejectRefresh = reject;
        });
      }
      throw new Error(`Unexpected request: ${path}`);
    }),
  );
  const wrapper = ({ children }: PropsWithChildren) => (
    <AuthProvider>{children}</AuthProvider>
  );
  const view = renderHook(() => useAuth(), { wrapper });
  await act(async () => {
    await view.result.current.login("user-a@example.com", "password");
  });

  let restore!: Promise<boolean>;
  act(() => {
    restore = view.result.current.restoreLiveSession();
  });
  await waitFor(() => assert.equal(typeof rejectRefresh, "function"));
  const previous = JSON.parse(
    window.localStorage.getItem("currentUser") ?? "{}",
  ) as { sessionEpoch?: number };
  const storedLogin = {
    sessionEpoch: (previous.sessionEpoch ?? 0) + 1,
    token: "token-b",
    liveUser: {
      id: "user-b",
      name: "User B",
      email: "user-b@example.com",
      role: "student",
    },
  };
  window.localStorage.setItem("currentUser", JSON.stringify(storedLogin));
  rejectRefresh(new TypeError("Refresh network failed"));

  await act(async () => {
    assert.equal(await restore, false);
  });

  assert.equal(view.result.current.currentUser.id, "user-b");
  assert.equal(view.result.current.isAuthenticated, true);
  assert.deepEqual(
    JSON.parse(window.localStorage.getItem("currentUser") ?? "{}"),
    storedLogin,
  );
});

test("a refresh rejection preserves a newer stored profile revision", async () => {
  let rejectRefresh!: (error: Error) => void;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const path = new URL(String(input)).pathname;
      if (path.endsWith("/auth/login")) {
        return Response.json({
          accessToken: "token-a",
          user: {
            id: "user-a",
            email: "user-a@example.com",
            fullName: "Old Name",
            role: "student",
          },
        });
      }
      if (path.endsWith("/auth/refresh")) {
        return new Promise<Response>((_resolve, reject) => {
          rejectRefresh = reject;
        });
      }
      throw new Error(`Unexpected request: ${path}`);
    }),
  );
  const wrapper = ({ children }: PropsWithChildren) => (
    <AuthProvider>{children}</AuthProvider>
  );
  const view = renderHook(() => useAuth(), { wrapper });
  await act(async () => {
    await view.result.current.login("user-a@example.com", "password");
  });

  let restore!: Promise<boolean>;
  act(() => {
    restore = view.result.current.restoreLiveSession();
  });
  await waitFor(() => assert.equal(typeof rejectRefresh, "function"));
  const previous = JSON.parse(
    window.localStorage.getItem("currentUser") ?? "{}",
  ) as { sessionEpoch: number; profileRevision: number };
  const storedProfile = {
    sessionEpoch: previous.sessionEpoch,
    profileRevision: previous.profileRevision + 1,
    token: "token-a",
    liveUser: {
      id: "user-a",
      name: "Saved Name",
      email: "user-a@example.com",
      role: "student",
    },
  };
  window.localStorage.setItem("currentUser", JSON.stringify(storedProfile));
  rejectRefresh(new TypeError("Refresh network failed"));

  await act(async () => {
    assert.equal(await restore, false);
  });

  assert.equal(view.result.current.currentUser.name, "Saved Name");
  assert.equal(view.result.current.isAuthenticated, true);
  assert.deepEqual(
    JSON.parse(window.localStorage.getItem("currentUser") ?? "{}"),
    storedProfile,
  );
});
