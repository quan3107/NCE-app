/**
 * Location: tests/authRefreshSessionRace.component.test.tsx
 * Purpose: Verify refresh retries remain bound to their initiating session.
 * Why: A delayed account-A refresh must never authorize a retry as account B.
 */
import assert from "node:assert/strict";
import type { PropsWithChildren } from "react";

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, test, vi } from "vitest";

import { AuthProvider, useAuth } from "../src/lib/auth";
import { apiClient } from "../src/lib/apiClient";
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

test.each(["success", "failure"] as const)(
  "a delayed refresh %s is cancelled before switching from A to B",
  async (outcome) => {
    let resolveRefresh!: (response: Response) => void;
    let rejectRefresh!: (error: Error) => void;
    const patchTokens: Array<string | null> = [];

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const path = new URL(String(input)).pathname;
        if (path.endsWith("/auth/login")) {
          const email = JSON.parse(String(init?.body)).email as string;
          const id = email.startsWith("a@") ? "user-a" : "user-b";
          return Response.json(authResponse(id, `token-${id.at(-1)}`));
        }
        if (path.endsWith("/auth/logout")) {
          return new Response(null, { status: 204 });
        }
        if (path.endsWith("/auth/refresh")) {
          return new Promise<Response>((resolve, reject) => {
            resolveRefresh = resolve;
            rejectRefresh = reject;
          });
        }
        if (path.endsWith("/me/profile")) {
          patchTokens.push(new Headers(init?.headers).get("authorization"));
          if (patchTokens.length === 1) {
            return new Response("Unauthorized", {
              status: 401,
              statusText: "Unauthorized",
            });
          }
          return Response.json({
            id: "user-b",
            email: "user-b@example.com",
            fullName: "Corrupted Name",
            role: "student",
            status: "active",
          });
        }
        throw new Error(`Unexpected request: ${path}`);
      }),
    );

    const wrapper = ({ children }: PropsWithChildren) => (
      <AuthProvider>{children}</AuthProvider>
    );
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.login("a@example.com", "password");
    });
    const request = apiClient("/me/profile", {
      method: "PATCH",
      body: { fullName: "Saved A" },
    }).then(
      () => null,
      (error: unknown) => error,
    );
    await waitFor(() => assert.equal(typeof resolveRefresh, "function"));

    let transitionComplete = false;
    const transition = (async () => {
      await result.current.logout();
      await result.current.login("b@example.com", "password");
      transitionComplete = true;
    })();
    await act(async () => {
      await transition;
    });
    assert.equal(transitionComplete, true);
    assert.equal(result.current.currentUser.id, "user-b");

    if (outcome === "success") {
      resolveRefresh(Response.json(authResponse("user-a", "refreshed-a")));
    } else {
      rejectRefresh(new Error("late refresh failed"));
    }
    const requestError = await request;
    assert.equal(
      requestError instanceof Error &&
        (requestError as { status?: number }).status === 0 &&
        /session changed/i.test(requestError.message),
      true,
    );
    assert.deepEqual(patchTokens, ["Bearer token-a"]);
    await waitFor(() => assert.equal(result.current.currentUser.id, "user-b"));
    assert.equal(result.current.isAuthenticated, true);
    assert.match(
      window.localStorage.getItem("currentUser") ?? "",
      /"id":"user-b"/,
    );
    assert.match(
      window.localStorage.getItem("currentUser") ?? "",
      /"token":"token-b"/,
    );
  },
);

test("logout clears local auth and cancels a hung refresh", async () => {
  let refreshStarted = false;
  let refreshSignal: AbortSignal | null = null;
  let logoutCalls = 0;

  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = new URL(String(input)).pathname;
      if (path.endsWith("/auth/login")) {
        return Response.json(authResponse("user-a", "token-a"));
      }
      if (path.endsWith("/auth/refresh")) {
        refreshStarted = true;
        refreshSignal = init?.signal ?? null;
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            "abort",
            () => reject(new DOMException("Aborted", "AbortError")),
            { once: true },
          );
        });
      }
      if (path.endsWith("/auth/logout")) {
        logoutCalls += 1;
        return new Response(null, { status: 204 });
      }
      if (path.endsWith("/me/profile")) {
        return new Response("Unauthorized", {
          status: 401,
          statusText: "Unauthorized",
        });
      }
      throw new Error(`Unexpected request: ${path}`);
    }),
  );

  const wrapper = ({ children }: PropsWithChildren) => (
    <AuthProvider>{children}</AuthProvider>
  );
  const { result } = renderHook(() => useAuth(), { wrapper });

  await act(async () => {
    await result.current.login("a@example.com", "password");
  });
  const protectedRequest = apiClient("/me/profile").catch(() => undefined);
  await waitFor(() => assert.equal(refreshStarted, true));

  let logoutPromise!: Promise<void>;
  act(() => {
    logoutPromise = result.current.logout();
  });

  await waitFor(() => assert.equal(result.current.isAuthenticated, false));
  assert.equal(result.current.currentUser.id, "");
  assert.equal(refreshSignal?.aborted, true);
  await act(async () => {
    await logoutPromise;
    await protectedRequest;
  });
  assert.equal(logoutCalls, 1);
});

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

  const wrapper = ({ children }: PropsWithChildren) => (
    <AuthProvider>{children}</AuthProvider>
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

  await act(async () => {
    await loginPromise;
    await logoutPromise;
  });
  assert.equal(result.current.isAuthenticated, false);
  assert.equal(result.current.currentUser.id, "");
});

test.each(["login", "registration"] as const)(
  "a delayed %s cannot replace a newer cross-tab logout",
  async (operation) => {
    let resolveAuth!: (response: Response) => void;

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const path = new URL(String(input)).pathname;
        if (
          path.endsWith("/auth/login") ||
          path.endsWith("/auth/register")
        ) {
          return new Promise<Response>((resolve) => {
            resolveAuth = resolve;
          });
        }
        throw new Error(`Unexpected request: ${path}`);
      }),
    );

    const wrapper = ({ children }: PropsWithChildren) => (
      <AuthProvider>{children}</AuthProvider>
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

    await act(async () => {
      await authPromise.catch(() => undefined);
    });
    assert.equal(result.current.isAuthenticated, false);
    assert.equal(result.current.currentUser.id, "");
    assert.doesNotMatch(
      window.localStorage.getItem("currentUser") ?? "",
      /user-a/,
    );
  },
);
