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
  vi.stubGlobal(
    "fetch",
    vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveRefresh = resolve;
        }),
    ),
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
        accessToken: "token-b",
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

  await waitFor(() =>
    assert.equal(result.current.auth.isRestoringSession, false),
  );
  assert.equal(result.current.auth.currentUser.name, "Saved Name");
  assert.equal(
    queryClient.getQueryData<{ fullName: string }>(queryKey)?.fullName,
    "Saved Name",
  );
  const persisted = window.localStorage.getItem("currentUser") ?? "";
  assert.match(persisted, /"token":"token-b"/);
  assert.match(persisted, /"name":"Saved Name"/);
});
