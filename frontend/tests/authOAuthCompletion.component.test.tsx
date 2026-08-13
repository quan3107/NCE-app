/**
 * Location: tests/authOAuthCompletion.component.test.tsx
 * Purpose: Verify OAuth completion owns and clears its cross-tab reservation.
 * Why: The callback may replace the initiating account only under its durable lease.
 */

import assert from "node:assert/strict";
import { useEffect, type PropsWithChildren } from "react";

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import {
  readIndexedDbAuthLease,
  writeIndexedDbAuthLease,
} from "../src/lib/auth-cookie-indexeddb-lock";
import { AuthProvider, useAuth } from "../src/lib/auth";
import { queryClient } from "../src/lib/queryClient";

const authResponse = {
  accessToken: "token-b",
  user: {
    id: "user-b",
    email: "user-b@example.com",
    fullName: "User B",
    role: "student",
  },
};

const withDeadline = <T,>(promise: Promise<T>): Promise<T> =>
  Promise.race([
    promise,
    new Promise<T>((_resolve, reject) => {
      setTimeout(
        () => reject(new Error("OAuth completion remained blocked")),
        250,
      );
    }),
  ]);

beforeEach(() => {
  window.history.replaceState({}, "", "/auth/oauth");
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

test("OAuth completion replaces the initiating account and clears its lease", async () => {
  window.localStorage.setItem(
    "currentUser",
    JSON.stringify({
      token: "token-a",
      liveUser: {
        id: "user-a",
        name: "User A",
        email: "user-a@example.com",
        role: "student",
      },
    }),
  );
  const expiresAt = Date.now() + 60_000;
  window.sessionStorage.setItem(
    "nce:auth-cookie-oauth-owner",
    JSON.stringify({ ownerId: "oauth-owner", expiresAt }),
  );
  await writeIndexedDbAuthLease({
    name: "oauth-reservation",
    ownerId: "oauth-owner",
    expiresAt,
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const path = new URL(String(input)).pathname;
      if (path.endsWith("/auth/refresh")) {
        return Response.json(authResponse);
      }
      throw new Error(`Unexpected request: ${path}`);
    }),
  );
  const wrapper = ({ children }: PropsWithChildren) => (
    <AuthProvider>{children}</AuthProvider>
  );
  const { result } = renderHook(() => useAuth(), { wrapper });
  assert.equal(result.current.currentUser.id, "");
  assert.equal(result.current.isAuthenticated, false);

  await act(async () => {
    assert.equal(await result.current.completeGoogleLogin(), "live");
  });

  assert.equal(result.current.currentUser.id, "user-b");
  assert.equal(await readIndexedDbAuthLease("oauth-reservation"), null);
});

test("OAuth callback child waits for provider bootstrap before admitting refresh", async () => {
  window.history.replaceState({}, "", "/auth/oauth");
  const expiresAt = Date.now() + 60_000;
  window.sessionStorage.setItem(
    "nce:auth-cookie-oauth-owner",
    JSON.stringify({ ownerId: "oauth-owner", expiresAt }),
  );
  await writeIndexedDbAuthLease({
    name: "oauth-reservation",
    ownerId: "oauth-owner",
    expiresAt,
  });
  let refreshCalls = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const path = new URL(String(input)).pathname;
      if (path.endsWith("/auth/refresh")) {
        refreshCalls += 1;
        return Response.json(authResponse);
      }
      if (path.endsWith("/me")) {
        return Response.json({ profile: authResponse.user });
      }
      throw new Error(`Unexpected request: ${path}`);
    }),
  );
  let completion: Promise<"live"> | undefined;
  function OAuthCallbackChild() {
    const { completeGoogleLogin } = useAuth();
    useEffect(() => {
      completion = completeGoogleLogin();
    }, [completeGoogleLogin]);
    return null;
  }

  renderHook(() => null, {
    wrapper: ({ children }: PropsWithChildren) => (
      <AuthProvider>
        <OAuthCallbackChild />
        {children}
      </AuthProvider>
    ),
  });

  await waitFor(() => assert.ok(completion));
  assert.equal(await completion, "live");
  assert.equal(refreshCalls, 1);
});

test("persisted acknowledged invalidation cannot queue ahead of its OAuth lease owner", async () => {
  const expiresAt = Date.now() + 60_000;
  window.localStorage.setItem(
    "nce:auth-invalidation",
    JSON.stringify({
      schemaVersion: 1,
      epoch: Date.now(),
      reason: "server-revalidate",
      nonce: "persisted-before-oauth-bootstrap",
    }),
  );
  window.sessionStorage.setItem(
    "nce:auth-cookie-oauth-owner",
    JSON.stringify({ ownerId: "oauth-owner", expiresAt }),
  );
  await writeIndexedDbAuthLease({
    name: "oauth-reservation",
    ownerId: "oauth-owner",
    expiresAt,
  });
  let refreshCalls = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const path = new URL(String(input)).pathname;
      if (path.endsWith("/auth/refresh")) {
        refreshCalls += 1;
        return Response.json(authResponse);
      }
      if (path.endsWith("/me")) {
        return Response.json({ profile: authResponse.user });
      }
      throw new Error(`Unexpected request: ${path}`);
    }),
  );
  const wrapper = ({ children }: PropsWithChildren) => (
    <AuthProvider>{children}</AuthProvider>
  );
  const view = renderHook(() => useAuth(), { wrapper });

  await expect(
    withDeadline(view.result.current.completeGoogleLogin()),
  ).resolves.toBe("live");
  assert.equal(refreshCalls, 1);
});

test("cancelling Google login fences its active cookie refresh", async () => {
  window.history.replaceState({}, "", "/auth/oauth");
  const expiresAt = Date.now() + 60_000;
  window.sessionStorage.setItem(
    "nce:auth-cookie-oauth-owner",
    JSON.stringify({ ownerId: "oauth-owner", expiresAt }),
  );
  await writeIndexedDbAuthLease({
    name: "oauth-reservation",
    ownerId: "oauth-owner",
    expiresAt,
  });
  let refreshStarted!: () => void;
  const started = new Promise<void>((resolve) => {
    refreshStarted = resolve;
  });
  let releaseRefresh!: () => void;
  let cookieLive = false;
  let refreshCalls = 0;
  const requests: string[] = [];
  const refreshReleased = new Promise<Response>((resolve) => {
    releaseRefresh = () => {
      cookieLive = true;
      resolve(Response.json(authResponse));
    };
  });
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL) => {
      const path = new URL(String(input)).pathname;
      requests.push(path);
      if (path.endsWith("/auth/logout")) {
        cookieLive = false;
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      if (path.endsWith("/auth/refresh")) {
        refreshCalls += 1;
        if (refreshCalls === 1) {
          refreshStarted();
          return refreshReleased;
        }
        return Promise.resolve(
          cookieLive
            ? Response.json(authResponse)
            : Response.json({ message: "Unauthorized" }, { status: 401 }),
        );
      }
      if (path.endsWith("/me")) {
        return Promise.resolve(Response.json({ profile: authResponse.user }));
      }
      throw new Error(`Unexpected request: ${path}`);
    }),
  );
  const wrapper = ({ children }: PropsWithChildren) => (
    <AuthProvider>{children}</AuthProvider>
  );
  const view = renderHook(() => useAuth(), { wrapper });
  const completion = view.result.current.completeGoogleLogin();
  await started;

  act(() => view.result.current.cancelGoogleLogin());

  await assert.rejects(completion);
  assert.notEqual(await readIndexedDbAuthLease("oauth-reservation"), null);
  releaseRefresh();
  await waitFor(async () => {
    assert.equal(await readIndexedDbAuthLease("oauth-reservation"), null);
    assert.equal(
      window.sessionStorage.getItem("nce:auth-cookie-oauth-owner"),
      null,
    );
  });
  assert.equal(view.result.current.isAuthenticated, false);

  window.history.replaceState({}, "", "/");
  view.unmount();
  const restored = renderHook(() => useAuth(), { wrapper });
  await waitFor(() =>
    assert.equal(restored.result.current.isRestoringSession, false),
  );

  assert.equal(cookieLive, false);
  assert.equal(restored.result.current.isAuthenticated, false);
  assert.equal(
    requests.filter((path) => path.endsWith("/auth/logout")).length,
    1,
  );
});

test("OAuth completion remains memory-only when legacy storage rejects writes", async () => {
  const values = new Map<string, string>();
  const expiresAt = Date.now() + 60_000;
  values.set(
    "nce:auth-cookie-oauth-owner",
    JSON.stringify({ ownerId: "oauth-owner", expiresAt }),
  );
  const storage = {
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => {
      if (key === "currentUser") {
        throw new DOMException("Storage write denied", "QuotaExceededError");
      }
      values.set(key, value);
    },
  };
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: storage,
  });
  Object.defineProperty(window, "sessionStorage", {
    configurable: true,
    value: storage,
  });
  await writeIndexedDbAuthLease({
    name: "oauth-reservation",
    ownerId: "oauth-owner",
    expiresAt,
  });
  const requests: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const path = new URL(String(input)).pathname;
      requests.push(path);
      if (path.endsWith("/auth/refresh")) return Response.json(authResponse);
      if (path.endsWith("/me")) {
        return Response.json({ profile: authResponse.user });
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

  assert.equal(await view.result.current.completeGoogleLogin(), "live");

  await waitFor(() =>
    assert.deepEqual(requests, ["/api/v1/auth/refresh", "/api/v1/me"]),
  );
  assert.equal(view.result.current.isAuthenticated, true);
  assert.equal(values.get("currentUser"), undefined);
});
