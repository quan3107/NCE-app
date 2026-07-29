/**
 * Location: tests/auth-session.component.test.tsx
 * Purpose: Verify identity generations and query cleanup across auth transitions.
 * Why: Late profile completions must never mutate a newer local session.
 */
import assert from "node:assert/strict";

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, test } from "vitest";

import { useAuthSession } from "../src/lib/auth-session";
import { queryClient } from "../src/lib/queryClient";

const session = (id: string, name: string, token: string) => ({
  accessToken: token,
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
  window.localStorage.clear();
});

test("rejects a stale identity update after an account switch", () => {
  const { result } = renderHook(() => useAuthSession());
  act(() => result.current.applyLiveSession(session("user-a", "User A", "token-a")));
  const initiatingIdentity = {
    userId: "user-a",
    generation: result.current.sessionGeneration,
  };

  act(() => result.current.applyLiveSession(session("user-b", "User B", "token-b")));
  let applied = true;
  act(() => {
    applied = result.current.updateLiveUser(initiatingIdentity, {
      name: "Corrupted Name",
    });
  });

  assert.equal(applied, false);
  assert.equal(result.current.liveUser?.id, "user-b");
  assert.equal(result.current.liveUser?.name, "User B");
});

test("clears identity queries on account switch and logout", () => {
  const { result } = renderHook(() => useAuthSession());
  act(() => result.current.applyLiveSession(session("user-a", "User A", "token-a")));
  queryClient.setQueryData(["identity", "user-a", "profile"], { id: "user-a" });

  act(() => result.current.applyLiveSession(session("user-b", "User B", "token-b")));
  assert.equal(
    queryClient.getQueryData(["identity", "user-a", "profile"]),
    undefined,
  );

  queryClient.setQueryData(["identity", "user-b", "profile"], { id: "user-b" });
  act(() => result.current.clearSession());
  assert.equal(
    queryClient.getQueryData(["identity", "user-b", "profile"]),
    undefined,
  );
});
