/**
 * Location: tests/authSessionIntentRace.component.test.tsx
 * Purpose: Verify queued auth intents commit in lock-admission order.
 * Why: The final UI identity must match the cookie written by the last admitted request.
 */
import assert from "node:assert/strict";
import type { PropsWithChildren } from "react";

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, test, vi } from "vitest";

import { AuthProvider, useAuth } from "../src/lib/auth";
import { queryClient } from "../src/lib/queryClient";

const authResponse = (id: string, token: string) => ({
  accessToken: token,
  user: {
    id,
    email: `${id}@example.com`,
    fullName: `User ${id.at(-1)?.toUpperCase()}`,
    role: "student",
  },
});

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
  queryClient.clear();
  vi.unstubAllGlobals();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

const wrapper = ({ children }: PropsWithChildren) => (
  <AuthProvider>{children}</AuthProvider>
);

test("logout remains locally clear after an earlier login completes", async () => {
  let resolveLogin!: (response: Response) => void;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const path = new URL(String(input)).pathname;
      if (path.endsWith("/auth/login")) {
        return new Promise<Response>((resolve) => {
          resolveLogin = resolve;
        });
      }
      if (path.endsWith("/auth/logout")) {
        return new Response(null, { status: 204 });
      }
      throw new Error(`Unexpected request: ${path}`);
    }),
  );
  const { result } = renderHook(() => useAuth(), { wrapper });
  let loginPromise!: Promise<"live" | null>;
  act(() => {
    loginPromise = result.current.login("a@example.com", "password");
  });
  await waitFor(() => assert.equal(typeof resolveLogin, "function"));
  let logoutPromise!: Promise<void>;
  act(() => {
    logoutPromise = result.current.logout();
  });
  resolveLogin(Response.json(authResponse("user-a", "token-a")));

  await act(async () => Promise.all([loginPromise, logoutPromise]));
  assert.equal(result.current.isAuthenticated, false);
  assert.equal(result.current.currentUser.id, "");
});

test("the login admitted last owns the cookie-matching UI session", async () => {
  let resolveFirstLogin!: (response: Response) => void;
  let loginCalls = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const path = new URL(String(input)).pathname;
      if (!path.endsWith("/auth/login")) {
        throw new Error(`Unexpected request: ${path}`);
      }
      loginCalls += 1;
      if (loginCalls === 1) {
        return new Promise<Response>((resolve) => {
          resolveFirstLogin = resolve;
        });
      }
      return Response.json(authResponse("user-b", "token-b"));
    }),
  );
  const { result } = renderHook(() => useAuth(), { wrapper });
  let first!: Promise<"live" | null>;
  let second!: Promise<"live" | null>;
  act(() => {
    first = result.current.login("a@example.com", "password");
    second = result.current.login("b@example.com", "password");
  });
  await waitFor(() => assert.equal(typeof resolveFirstLogin, "function"));
  resolveFirstLogin(Response.json(authResponse("user-a", "token-a")));

  await act(async () => {
    assert.deepEqual(await Promise.all([first, second]), ["live", "live"]);
  });
  assert.equal(result.current.currentUser.id, "user-b");
  assert.match(window.localStorage.getItem("currentUser") ?? "", /"id":"user-b"/);
});

test.each(["login", "registration"] as const)(
  "a delayed %s cannot replace a newer cross-tab logout",
  async (operation) => {
    let resolveAuth!: (response: Response) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const path = new URL(String(input)).pathname;
        if (path.endsWith("/auth/login") || path.endsWith("/auth/register")) {
          return new Promise<Response>((resolve) => {
            resolveAuth = resolve;
          });
        }
        throw new Error(`Unexpected request: ${path}`);
      }),
    );
    const { result } = renderHook(() => useAuth(), { wrapper });
    let authPromise!: Promise<unknown>;
    act(() => {
      authPromise =
        operation === "login"
          ? result.current.login("a@example.com", "password")
          : result.current.register({
              fullName: "User A",
              email: "a@example.com",
              password: "password",
              role: "student",
            });
    });
    await waitFor(() => assert.equal(typeof resolveAuth, "function"));
    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "currentUser",
          newValue: JSON.stringify({
            sessionEpoch: Date.now() + 10_000,
            token: null,
            liveUser: null,
          }),
        }),
      );
    });
    resolveAuth(Response.json(authResponse("user-a", "token-a")));

    await act(async () => authPromise.catch(() => undefined));
    assert.equal(result.current.isAuthenticated, false);
    assert.equal(result.current.currentUser.id, "");
    assert.doesNotMatch(window.localStorage.getItem("currentUser") ?? "", /user-a/);
  },
);
