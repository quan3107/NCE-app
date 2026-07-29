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
});

test.each(["success", "failure"] as const)(
  "a delayed refresh %s cannot retry or clear across A to B",
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
    });
    await waitFor(() => assert.equal(typeof resolveRefresh, "function"));

    await act(async () => {
      await result.current.logout();
      await result.current.login("b@example.com", "password");
    });
    if (outcome === "success") {
      resolveRefresh(Response.json(authResponse("user-a", "refreshed-a")));
    } else {
      rejectRefresh(new Error("late refresh failed"));
    }

    await assert.rejects(request, (error: unknown) => {
      return (
        error instanceof Error &&
        (error as { status?: number }).status === 401
      );
    });
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
