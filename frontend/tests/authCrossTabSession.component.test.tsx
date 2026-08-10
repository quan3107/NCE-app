/**
 * Location: tests/authCrossTabSession.component.test.tsx
 * Purpose: Verify shared session epochs invalidate stale bearer work across tabs.
 * Why: Logout, account, and authorization transitions must apply in every tab.
 */
import assert from "node:assert/strict";

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, test, vi } from "vitest";

import { apiClient } from "../src/lib/apiClient";
import { authBridge } from "../src/lib/authBridge";
import { useAuthSession } from "../src/lib/auth-session";
import { queryClient } from "../src/lib/queryClient";

const liveSession = {
  accessToken: "token-a",
  user: {
    id: "user-a",
    email: "user-a@example.com",
    fullName: "User A",
    role: "student" as const,
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
  authBridge.reset();
  queryClient.clear();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

test("a newer cross-tab logout aborts bearer work and clears scoped state", async () => {
  const { result } = renderHook(() => useAuthSession());
  act(() => result.current.applyLiveSession(liveSession));
  authBridge.configure({
    getAccessToken: () => result.current.tokenRef.current,
    getSessionVersion: result.current.getSessionVersion,
  });
  queryClient.setQueryData(["identity", "user-a", "profile"], {
    id: "user-a",
  });
  let requestSignal: AbortSignal | undefined;
  vi.stubGlobal(
    "fetch",
    vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      requestSignal = init?.signal ?? undefined;
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => reject(new DOMException("Aborted", "AbortError")),
          { once: true },
        );
      });
    }),
  );

  const pendingRequest = apiClient("/me/profile");
  act(() => {
    const nextEpoch = result.current.getSessionVersion().sessionEpoch + 1;
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: "currentUser",
        newValue: JSON.stringify({
          sessionEpoch: nextEpoch,
          token: null,
          liveUser: null,
        }),
      }),
    );
  });

  await assert.rejects(pendingRequest, /session changed/i);
  assert.equal(requestSignal?.aborted, true);
  assert.equal(result.current.liveUser, null);
  assert.equal(result.current.tokenRef.current, null);
  assert.equal(
    queryClient.getQueryData(["identity", "user-a", "profile"]),
    undefined,
  );
});

test("a newer stored epoch blocks bearer mutation before event delivery", async () => {
  const { result } = renderHook(() => useAuthSession());
  act(() => result.current.applyLiveSession(liveSession));
  authBridge.configure({
    getAccessToken: () => result.current.tokenRef.current,
    getSessionVersion: result.current.getSessionVersion,
  });
  const fetchMock = vi.fn(async () => Response.json({ updated: true }));
  vi.stubGlobal("fetch", fetchMock);
  const nextEpoch = result.current.getSessionVersion().sessionEpoch + 1;
  window.localStorage.setItem(
    "currentUser",
    JSON.stringify({
      sessionEpoch: nextEpoch,
      token: null,
      liveUser: null,
    }),
  );

  await assert.rejects(
    apiClient("/me/profile", {
      method: "PATCH",
      body: { fullName: "Stale account mutation" },
    }),
    /session changed/i,
  );

  assert.equal(fetchMock.mock.calls.length, 0);
  assert.equal(result.current.liveUser?.id, "user-a");
  assert.equal(result.current.tokenRef.current, "token-a");
});

test("a newer stored epoch rejects an in-flight bearer response", async () => {
  const { result } = renderHook(() => useAuthSession());
  act(() => result.current.applyLiveSession(liveSession));
  authBridge.configure({
    getAccessToken: () => result.current.tokenRef.current,
    getSessionVersion: result.current.getSessionVersion,
  });
  let resolveResponse!: (response: Response) => void;
  let markRequestStarted = () => undefined;
  const requestStarted = new Promise<void>((resolve) => {
    markRequestStarted = resolve;
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveResponse = resolve;
          markRequestStarted();
        }),
    ),
  );

  const pendingRequest = apiClient("/me/profile", { method: "PATCH" });
  await requestStarted;
  window.localStorage.setItem(
    "currentUser",
    JSON.stringify({
      sessionEpoch: result.current.getSessionVersion().sessionEpoch + 1,
      token: null,
      liveUser: null,
    }),
  );
  resolveResponse(Response.json({ updated: true }));

  await assert.rejects(pendingRequest, /session changed/i);
  assert.equal(result.current.liveUser?.id, "user-a");
});

test("a newer stored epoch blocks retry admission after refresh", async () => {
  const { result } = renderHook(() => useAuthSession());
  act(() => result.current.applyLiveSession(liveSession));
  let requestCount = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      requestCount += 1;
      return requestCount === 1
        ? new Response("", { status: 401 })
        : Response.json({ updated: true });
    }),
  );
  authBridge.configure({
    getAccessToken: () => result.current.tokenRef.current,
    getSessionVersion: result.current.getSessionVersion,
    refreshAccessToken: async () => {
      window.localStorage.setItem(
        "currentUser",
        JSON.stringify({
          sessionEpoch: result.current.getSessionVersion().sessionEpoch + 1,
          token: null,
          liveUser: null,
        }),
      );
      return { status: "refreshed", accessToken: "retry-token" };
    },
  });

  await assert.rejects(
    apiClient("/me/profile", { method: "PATCH" }),
    /session changed/i,
  );
  assert.equal(requestCount, 1);
});

test("a late same-session refresh cannot overwrite a newer stored epoch", () => {
  const { result } = renderHook(() => useAuthSession());
  act(() => result.current.applyLiveSession(liveSession));
  const remoteSnapshot = {
    sessionEpoch: result.current.getSessionVersion().sessionEpoch + 1,
    token: "token-b",
    liveUser: {
      id: "user-b",
      name: "User B",
      email: "user-b@example.com",
      role: "student",
    },
  };
  window.localStorage.setItem("currentUser", JSON.stringify(remoteSnapshot));

  act(() =>
    result.current.applyLiveSession({
      ...liveSession,
      accessToken: "late-token-a",
    }),
  );

  assert.deepEqual(
    JSON.parse(window.localStorage.getItem("currentUser") ?? "{}"),
    remoteSnapshot,
  );
});
