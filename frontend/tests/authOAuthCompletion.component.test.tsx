/**
 * Location: tests/authOAuthCompletion.component.test.tsx
 * Purpose: Verify OAuth completion owns and clears its cross-tab reservation.
 * Why: The callback may replace the initiating account only under its durable lease.
 */

import assert from "node:assert/strict";
import type { PropsWithChildren } from "react";

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, test, vi } from "vitest";

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
  assert.equal(result.current.currentUser.id, "user-a");

  await act(async () => {
    assert.equal(await result.current.completeGoogleLogin(), "live");
  });

  assert.equal(result.current.currentUser.id, "user-b");
  assert.equal(await readIndexedDbAuthLease("oauth-reservation"), null);
});

test("leaving the callback cancels an unfinished OAuth completion", async () => {
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
  const started = new Promise<void>((resolve) => { refreshStarted = resolve; });
  vi.stubGlobal("fetch", vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
    refreshStarted();
    return new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), {
        once: true,
      });
    });
  }));
  const wrapper = ({ children }: PropsWithChildren) => (
    <AuthProvider>{children}</AuthProvider>
  );
  const view = renderHook(() => useAuth(), { wrapper });
  const completion = view.result.current.completeGoogleLogin();
  await started;

  act(() => view.result.current.cancelGoogleLogin());

  await assert.rejects(completion);
  assert.equal(view.result.current.isAuthenticated, false);
});
