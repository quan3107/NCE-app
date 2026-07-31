/**
 * Location: tests/auth-session-role-change.component.test.tsx
 * Purpose: Verify same-user authorization changes replace the query scope.
 * Why: A refreshed role must not retain cache data from the previous role.
 */
import assert from "node:assert/strict";

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, test } from "vitest";

import { useAuthSession } from "../src/lib/auth-session";
import { queryClient } from "../src/lib/queryClient";
import type { SupportedRole } from "../src/lib/auth-types";

const session = (
  role: SupportedRole,
  options: {
    email?: string;
    fullName?: string;
    token?: string;
  } = {},
) => ({
  accessToken: options.token ?? `token-${role}`,
  user: {
    id: "same-user",
    email: options.email ?? "same-user@example.com",
    fullName: options.fullName ?? "Same User",
    role,
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

test("same-user role changes advance generation and clear authenticated data", () => {
  const { result } = renderHook(() => useAuthSession());
  act(() => result.current.applyLiveSession(session("admin")));
  const previousGeneration = result.current.sessionGeneration;
  queryClient.setQueryData(["admin", "audit-logs"], ["sensitive"]);

  act(() => result.current.applyLiveSession(session("student")));

  assert.equal(result.current.liveUser?.role, "student");
  assert.equal(result.current.sessionGeneration, previousGeneration + 1);
  assert.equal(queryClient.getQueryData(["admin", "audit-logs"]), undefined);
});

test("a concurrent profile edit preserves only the editable name", () => {
  const { result } = renderHook(() => useAuthSession());
  act(() => result.current.applyLiveSession(session("admin")));
  const expectedVersion = result.current.getSessionVersion();
  const previousGeneration = result.current.sessionGeneration;

  act(() => {
    result.current.updateLiveUser(
      {
        userId: expectedVersion.userId!,
        generation: expectedVersion.generation,
      },
      { name: "Locally Edited Name" },
    );
  });
  queryClient.setQueryData(["admin", "settings"], { editable: true });

  act(() => {
    result.current.applyLiveSession(
      session("student", {
        email: "authoritative@example.com",
        fullName: "Stale Server Name",
        token: "refreshed-token",
      }),
      expectedVersion,
    );
  });

  assert.deepEqual(result.current.liveUser, {
    id: "same-user",
    name: "Locally Edited Name",
    email: "authoritative@example.com",
    role: "student",
  });
  assert.equal(result.current.sessionGeneration, previousGeneration + 1);
  assert.equal(queryClient.getQueryData(["admin", "settings"]), undefined);
  assert.equal(result.current.tokenRef.current, "refreshed-token");
});
