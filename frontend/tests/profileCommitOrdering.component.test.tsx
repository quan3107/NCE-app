/**
 * Location: tests/profileCommitOrdering.component.test.tsx
 * Purpose: Verify profile response ordering is scoped to a session identity.
 * Why: A stale account-A completion must not supersede account B's commit.
 */
import assert from "node:assert/strict";
import type { PropsWithChildren } from "react";

import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, test, vi } from "vitest";

import { meProfileQueryKey } from "../src/features/profile/api";
import { useAuthSession } from "../src/lib/auth-session";
import { queryClient } from "../src/lib/queryClient";

const session = (id: string, name: string) => ({
  accessToken: `token-${id}`,
  user: {
    id,
    email: `${id}@example.com`,
    fullName: name,
    role: "student" as const,
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
  vi.restoreAllMocks();
  window.localStorage.clear();
});

test("a stale A commit cannot supersede a waiting B commit", async () => {
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => {
    const authSession = useAuthSession();
    useQuery({
      queryKey: meProfileQueryKey("user-b"),
      queryFn: async () => ({ id: "user-b", fullName: "User B" }),
      enabled: false,
    });
    return authSession;
  }, { wrapper });
  act(() => result.current.applyLiveSession(session("user-a", "User A")));
  const identityA = {
    userId: "user-a",
    generation: result.current.sessionGeneration,
  };
  act(() => result.current.applyLiveSession(session("user-b", "User B")));
  const identityB = {
    userId: "user-b",
    generation: result.current.sessionGeneration,
  };

  let releaseB!: () => void;
  vi.spyOn(queryClient, "cancelQueries").mockImplementation((filters) => {
    const key = filters?.queryKey;
    if (Array.isArray(key) && key[1] === "user-b") {
      return new Promise<void>((resolve) => {
        releaseB = resolve;
      });
    }
    return Promise.resolve();
  });

  const commitB = result.current.commitLiveProfile(identityB, {
    id: "user-b",
    email: "user-b@example.com",
    fullName: "Updated B",
    role: "student",
    status: "active",
  });
  await waitFor(() => assert.equal(typeof releaseB, "function"));
  let staleA = true;
  await act(async () => {
    staleA = await result.current.commitLiveProfile(identityA, {
      id: "user-a",
      email: "user-a@example.com",
      fullName: "Late A",
      role: "student",
      status: "active",
    });
  });
  let appliedB = false;
  await act(async () => {
    releaseB();
    appliedB = await commitB;
  });

  assert.equal(staleA, false);
  assert.equal(appliedB, true);
  assert.equal(result.current.liveUser?.name, "Updated B");
  assert.equal(
    queryClient.getQueryData<{ fullName: string }>(
      meProfileQueryKey("user-b"),
    )?.fullName,
    "Updated B",
  );
  assert.match(
    window.localStorage.getItem("currentUser") ?? "",
    /"name":"Updated B"/,
  );
});
