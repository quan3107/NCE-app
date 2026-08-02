/**
 * Location: tests/profileSharedRevision.component.test.tsx
 * Purpose: Verify authoritative profile commits survive storage failure and reach peers.
 * Why: Durable auth storage is not the source of truth for a successful profile write.
 */
import assert from "node:assert/strict";

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, test, vi } from "vitest";

import { meProfileQueryKey } from "../src/features/profile/api";
import { useAuthSession } from "../src/lib/auth-session";
import { queryClient } from "../src/lib/queryClient";

const liveSession = {
  accessToken: "token-a",
  user: {
    id: "user-a",
    email: "user-a@example.com",
    fullName: "Old Name",
    role: "student" as const,
  },
};

type Listener = (event: MessageEvent<unknown>) => void;
const listeners = new Set<Listener>();

class TestBroadcastChannel {
  addEventListener(_type: string, listener: Listener) {
    listeners.add(listener);
  }
  close() {}
  postMessage(data: unknown) {
    for (const listener of listeners) listener({ data } as MessageEvent);
  }
  removeEventListener(_type: string, listener: Listener) {
    listeners.delete(listener);
  }
}

beforeEach(() => {
  listeners.clear();
  vi.stubGlobal("BroadcastChannel", TestBroadcastChannel);
  for (const storageName of ["localStorage", "sessionStorage"] as const) {
    const values = new Map<string, string>();
    Object.defineProperty(window, storageName, {
      configurable: true,
      value: {
        clear: () => values.clear(),
        getItem: (key: string) => values.get(key) ?? null,
        removeItem: (key: string) => values.delete(key),
        setItem: (key: string, value: string) => values.set(key, value),
      },
    });
  }
});

afterEach(() => {
  cleanup();
  queryClient.clear();
  vi.unstubAllGlobals();
});

test("a saved profile updates memory and cache when both stores reject writes", async () => {
  const view = renderHook(() => useAuthSession());
  act(() => view.result.current.applyLiveSession(liveSession));
  const identity = {
    userId: "user-a",
    generation: view.result.current.sessionGeneration,
  };
  const stored = window.localStorage.getItem("currentUser");
  const rejectedStorage = {
    clear: () => undefined,
    getItem: () => stored,
    removeItem: () => undefined,
    setItem: () => {
      throw new DOMException("Storage write denied", "QuotaExceededError");
    },
  };
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: rejectedStorage,
  });
  Object.defineProperty(window, "sessionStorage", {
    configurable: true,
    value: rejectedStorage,
  });

  let committed = false;
  await act(async () => {
    committed = await view.result.current.commitLiveProfile(identity, {
      id: "user-a",
      email: "user-a@example.com",
      fullName: "Saved Name",
      role: "student",
      status: "active",
    });
  });

  assert.equal(committed, true);
  assert.equal(view.result.current.liveUser?.name, "Saved Name");
  assert.equal(
    queryClient.getQueryData<{ fullName: string }>(meProfileQueryKey("user-a"))
      ?.fullName,
    "Saved Name",
  );
});

test("a same-session profile revision updates a subscribed peer", async () => {
  const primary = renderHook(() => useAuthSession());
  const peer = renderHook(() => useAuthSession());
  act(() => primary.result.current.applyLiveSession(liveSession));
  const peerGeneration = peer.result.current.sessionGeneration;
  const identity = {
    userId: "user-a",
    generation: primary.result.current.sessionGeneration,
  };

  await act(async () => {
    await primary.result.current.commitLiveProfile(identity, {
      id: "user-a",
      email: "user-a@example.com",
      fullName: "Shared Name",
      role: "student",
      status: "active",
    });
  });

  assert.equal(peer.result.current.liveUser?.name, "Shared Name");
  assert.equal(peer.result.current.sessionGeneration, peerGeneration);
});

test("a late profile commit cannot replace a newer stored account", async () => {
  const view = renderHook(() => useAuthSession());
  act(() => view.result.current.applyLiveSession(liveSession));
  const identity = {
    userId: "user-a",
    generation: view.result.current.sessionGeneration,
  };
  const current = JSON.parse(
    window.localStorage.getItem("currentUser") ?? "{}",
  ) as { sessionEpoch: number };
  const nextAccount = {
    sessionEpoch: current.sessionEpoch + 1,
    profileRevision: 0,
    token: "token-b",
    liveUser: {
      id: "user-b",
      name: "User B",
      email: "user-b@example.com",
      role: "student",
    },
  };
  window.localStorage.setItem("currentUser", JSON.stringify(nextAccount));

  let committed = true;
  await act(async () => {
    committed = await view.result.current.commitLiveProfile(identity, {
      id: "user-a",
      email: "user-a@example.com",
      fullName: "Late A",
      role: "student",
      status: "active",
    });
  });

  assert.equal(committed, false);
  assert.equal(view.result.current.liveUser?.id, "user-b");
  assert.deepEqual(
    JSON.parse(window.localStorage.getItem("currentUser") ?? "{}"),
    nextAccount,
  );
});
