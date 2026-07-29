/**
 * Location: tests/auth-session.component.test.tsx
 * Purpose: Verify identity generations and query cleanup across auth transitions.
 * Why: Late profile completions must never mutate a newer local session.
 */
import assert from "node:assert/strict";

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, test, vi } from "vitest";

import { apiClient } from "../src/lib/apiClient";
import { authBridge } from "../src/lib/authBridge";
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
  authBridge.reset();
  queryClient.clear();
  vi.unstubAllGlobals();
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

test("synchronizes an independently stale profile cache on same-user refresh", () => {
  const { result } = renderHook(() => useAuthSession());
  act(() => result.current.applyLiveSession(session("user-a", "Old Name", "token-a")));
  queryClient.setQueryData(["identity", "user-a", "profile"], {
    id: "user-a",
    email: "user-a@example.com",
    fullName: "Old Name",
    role: "student",
    status: "active",
  });

  act(() => {
    result.current.applyLiveSession(session("user-a", "New Name", "token-b"));
  });

  assert.equal(
    queryClient.getQueryData<{ fullName: string }>([
      "identity",
      "user-a",
      "profile",
    ])?.fullName,
    "New Name",
  );
});

test("accepts a PATCH retry after a 401 refreshes the same user", async () => {
  const { result } = renderHook(() => useAuthSession());
  act(() => result.current.applyLiveSession(session("user-a", "User A", "token-a")));
  const initiatingIdentity = {
    userId: "user-a",
    generation: result.current.sessionGeneration,
  };
  let requestCount = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      requestCount += 1;
      const headers = new Headers(init?.headers);
      assert.equal(init?.method, "PATCH");
      if (requestCount === 1) {
        assert.equal(headers.get("authorization"), "Bearer token-a");
        return new Response("", { status: 401 });
      }

      assert.equal(headers.get("authorization"), "Bearer token-b");
      return new Response(
        JSON.stringify({
          id: "user-a",
          email: "user-a@example.com",
          fullName: "Saved Name",
          role: "student",
          status: "active",
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    }),
  );
  authBridge.configure({
    getAccessToken: () => result.current.tokenRef.current,
    refreshAccessToken: async () => {
      act(() => {
        result.current.applyLiveSession(session("user-a", "User A", "token-b"));
      });
      return result.current.tokenRef.current;
    },
  });

  const saved = await apiClient<{ fullName: string }, { fullName: string }>(
    "/api/v1/me/profile",
    {
      method: "PATCH",
      body: { fullName: "Saved Name" },
    },
  );
  let applied = false;
  act(() => {
    applied = result.current.updateLiveUser(initiatingIdentity, {
      name: saved.fullName,
    });
  });

  assert.equal(requestCount, 2);
  assert.equal(result.current.sessionGeneration, initiatingIdentity.generation);
  assert.equal(applied, true);
  assert.equal(result.current.liveUser?.name, "Saved Name");
});
