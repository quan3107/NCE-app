/**
 * Location: tests/authRefreshOrdering.component.test.tsx
 * Purpose: Verify delayed refresh responses cannot replace newer profile state.
 * Why: Token freshness and user-profile freshness advance independently.
 */
import assert from "node:assert/strict";
import type { PropsWithChildren } from "react";

import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, test, vi } from "vitest";

import { AuthProvider, useAuth } from "../src/lib/auth";
import { queryClient } from "../src/lib/queryClient";

const initialSnapshot = {
  token: "token-a",
  liveUser: {
    id: "user-a",
    name: "Old Name",
    email: "user-a@example.com",
    role: "student",
  },
};

beforeEach(() => {
  const values = new Map<string, string>([
    ["currentUser", JSON.stringify(initialSnapshot)],
  ]);
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

test("a delayed same-user refresh preserves a newer successful save", async () => {
  let resolveRefresh!: (response: Response) => void;
  let refreshCount = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      refreshCount += 1;
      if (refreshCount === 1) {
        return Promise.resolve(
          Response.json({
            accessToken: "token-b",
            user: {
              id: "user-a",
              email: "user-a@example.com",
              fullName: "Old Name",
              role: "student",
            },
          }),
        );
      }
      return new Promise<Response>((resolve) => {
        resolveRefresh = resolve;
      });
    }),
  );
  const queryKey = ["identity", "user-a", "profile"] as const;
  queryClient.setQueryData(queryKey, {
    id: "user-a",
    fullName: "Old Name",
  });
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
  const { result } = renderHook(
    () => ({
      auth: useAuth(),
      profile: useQuery({
        queryKey,
        queryFn: async () => ({ id: "user-a", fullName: "Old Name" }),
        enabled: false,
      }),
    }),
    { wrapper },
  );
  await waitFor(() => assert.equal(result.current.auth.isAuthenticated, true));
  const delayedRefresh = result.current.auth.restoreLiveSession();
  await waitFor(() => assert.equal(typeof resolveRefresh, "function"));
  const initiatingIdentity = {
    userId: "user-a",
    generation: result.current.auth.sessionGeneration,
  };

  act(() => {
    assert.equal(
      result.current.auth.updateCurrentUser(initiatingIdentity, {
        name: "Saved Name",
      }),
      true,
    );
    queryClient.setQueryData(queryKey, {
      id: "user-a",
      fullName: "Saved Name",
    });
  });
  resolveRefresh(
    new Response(
      JSON.stringify({
        accessToken: "token-c",
        user: {
          id: "user-a",
          email: "user-a@example.com",
          fullName: "Old Name",
          role: "student",
        },
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    ),
  );

  await delayedRefresh;
  await waitFor(() =>
    assert.equal(result.current.auth.isRestoringSession, false),
  );
  assert.equal(result.current.auth.currentUser.name, "Saved Name");
  assert.equal(
    queryClient.getQueryData<{ fullName: string }>(queryKey)?.fullName,
    "Saved Name",
  );
  const persisted = window.localStorage.getItem("currentUser") ?? "";
  assert.match(persisted, /"token":"token-c"/);
  assert.match(persisted, /"name":"Saved Name"/);
});

test("unmount cancellation does not erase the persisted session", async () => {
  let refreshSignal: AbortSignal | undefined;
  vi.stubGlobal(
    "fetch",
    vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      refreshSignal = init?.signal ?? undefined;
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => reject(new DOMException("Aborted", "AbortError")),
          { once: true },
        );
      });
    }),
  );
  const wrapper = ({ children }: PropsWithChildren) => (
    <AuthProvider>{children}</AuthProvider>
  );
  const view = renderHook(() => useAuth(), { wrapper });
  await waitFor(() => assert.equal(Boolean(refreshSignal), true));

  view.unmount();
  await waitFor(() => assert.equal(refreshSignal?.aborted, true));

  assert.match(
    window.localStorage.getItem("currentUser") ?? "",
    /"token":"token-a"/,
  );
});
