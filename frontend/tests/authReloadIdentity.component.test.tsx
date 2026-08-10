/**
 * Location: tests/authReloadIdentity.component.test.tsx
 * Purpose: Verify reload restoration only fences peers for real authorization changes.
 * Why: A same-user refresh must not abort mutations already running in another tab.
 */
import assert from "node:assert/strict";

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, test, vi } from "vitest";

import { apiClient } from "../src/lib/apiClient";
import { useAuthSession } from "../src/lib/auth-session";
import { authBridge } from "../src/lib/authBridge";
import { queryClient } from "../src/lib/queryClient";

const session = (id: string, role: "student" | "teacher") => ({
  accessToken: `token-${id}-${role}`,
  user: {
    id,
    email: `${id}@example.com`,
    fullName: id === "user-a" ? "User A" : "User B",
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
  authBridge.reset();
  queryClient.clear();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

function startPeerRequest(peer: ReturnType<typeof useAuthSession>) {
  authBridge.configure({
    getAccessToken: () => peer.tokenRef.current,
    getSessionVersion: peer.getSessionVersion,
  });
  let requestSignal: AbortSignal | undefined;
  let resolveRequest!: (response: Response) => void;
  vi.stubGlobal(
    "fetch",
    vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      requestSignal = init?.signal ?? undefined;
      return new Promise<Response>((resolve, reject) => {
        resolveRequest = resolve;
        init?.signal?.addEventListener(
          "abort",
          () => reject(new DOMException("Aborted", "AbortError")),
          { once: true },
        );
      });
    }),
  );
  return {
    pending: apiClient<{ updated: boolean }>("/me/profile", {
      method: "PATCH",
    }),
    resolveRequest,
    signal: () => requestSignal,
  };
}

test("same-user reload preserves the epoch and peer request", async () => {
  const peer = renderHook(() => useAuthSession());
  act(() => peer.result.current.applyLiveSession(session("user-a", "student")));
  const epoch = peer.result.current.getSessionVersion().sessionEpoch;
  const reloaded = renderHook(() => useAuthSession());
  const request = startPeerRequest(peer.result.current);

  act(() =>
    reloaded.result.current.applyLiveSession(session("user-a", "student")),
  );

  assert.equal(reloaded.result.current.getSessionVersion().sessionEpoch, epoch);
  assert.equal(request.signal()?.aborted, false);
  request.resolveRequest(Response.json({ updated: true }));
  assert.deepEqual(await request.pending, { updated: true });
});

test("an invalid persisted role cannot suppress an authorization transition", () => {
  window.localStorage.setItem(
    "currentUser",
    JSON.stringify({
      sessionEpoch: 7,
      profileRevision: 0,
      token: "untrusted-token",
      liveUser: {
        id: "user-a",
        name: "User A",
        email: "user-a@example.com",
        role: "owner",
      },
    }),
  );
  const reloaded = renderHook(() => useAuthSession());

  act(() =>
    reloaded.result.current.applyLiveSession(session("user-a", "student")),
  );

  assert.equal(reloaded.result.current.getSessionVersion().sessionEpoch > 7, true);
});

test.each([
  ["changed user", session("user-b", "student")],
  ["changed role", session("user-a", "teacher")],
])("%s restoration advances the epoch and aborts peer work", async (_label, restored) => {
  const peer = renderHook(() => useAuthSession());
  act(() => peer.result.current.applyLiveSession(session("user-a", "student")));
  const epoch = peer.result.current.getSessionVersion().sessionEpoch;
  const reloaded = renderHook(() => useAuthSession());
  const request = startPeerRequest(peer.result.current);

  act(() => reloaded.result.current.applyLiveSession(restored));

  await assert.rejects(request.pending, /session changed/i);
  assert.equal(request.signal()?.aborted, true);
  assert.equal(
    reloaded.result.current.getSessionVersion().sessionEpoch > epoch,
    true,
  );
});
