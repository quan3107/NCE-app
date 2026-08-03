/**
 * Location: tests/authenticatedQueryIsolation.component.test.tsx
 * Purpose: Verify authenticated cache and response isolation across accounts.
 * Why: Same-role replacements must not expose prior-actor data or late responses.
 */
import assert from "node:assert/strict";

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, test, vi } from "vitest";

import { apiClient } from "../src/lib/apiClient";
import { authBridge } from "../src/lib/authBridge";
import { useAuthSession } from "../src/lib/auth-session";
import { queryClient } from "../src/lib/queryClient";

const session = (id: string, token: string) => ({
  accessToken: token,
  user: {
    id,
    email: `${id}@example.com`,
    fullName: id,
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

test("same-role replacement clears and renamespaces actor-scoped queries", () => {
  const { result } = renderHook(() => useAuthSession());
  act(() => result.current.applyLiveSession(session("user-a", "token-a")));
  queryClient.setQueryData(["courses", "list"], [{ id: "course-a" }]);
  const accountAQueryHash = queryClient
    .getQueryCache()
    .find({ queryKey: ["courses", "list"], exact: true })?.queryHash;

  act(() => result.current.applyLiveSession(session("user-b", "token-b")));
  assert.equal(queryClient.getQueryData(["courses", "list"]), undefined);
  queryClient.setQueryData(["courses", "list"], [{ id: "course-b" }]);
  const accountBQueryHash = queryClient
    .getQueryCache()
    .find({ queryKey: ["courses", "list"], exact: true })?.queryHash;

  assert.notEqual(accountBQueryHash, accountAQueryHash);
  assert.deepEqual(queryClient.getQueryData(["courses", "list"]), [
    { id: "course-b" },
  ]);
});

test("rejects an authenticated response completed by an old session", async () => {
  const { result } = renderHook(() => useAuthSession());
  act(() => result.current.applyLiveSession(session("user-a", "token-a")));
  authBridge.configure({
    getAccessToken: () => result.current.tokenRef.current,
    getSessionVersion: result.current.getSessionVersion,
  });
  let resolveRequest!: (response: Response) => void;
  vi.stubGlobal(
    "fetch",
    vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveRequest = resolve;
        }),
    ),
  );

  const oldRequest = apiClient<Array<{ id: string }>>("/api/v1/courses");
  await waitFor(() => assert.equal(typeof resolveRequest, "function"));
  act(() => result.current.applyLiveSession(session("user-b", "token-b")));
  resolveRequest(Response.json([{ id: "course-a" }]));

  await assert.rejects(oldRequest, /session changed/i);
});

test("terminates before applying changed authorization fields", async () => {
  const { result } = renderHook(() => useAuthSession());
  act(() => result.current.applyLiveSession(session("user-a", "token-a")));
  const identity = {
    userId: "user-a",
    generation: result.current.sessionGeneration,
  };

  let applied = true;
  await act(async () => {
    applied = await result.current.commitLiveProfile(identity, {
      id: "user-a",
      email: "user-a@example.com",
      fullName: "User A",
      role: "teacher",
      status: "active",
    });
  });

  assert.equal(applied, false);
  assert.equal(result.current.liveUser, null);
  assert.equal(result.current.tokenRef.current, null);
});
