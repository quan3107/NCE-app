/**
 * Location: tests/profileSharedRevision.component.test.tsx
 * Purpose: Verify authoritative profile commits survive storage failure and reach peers.
 * Why: Durable auth storage is not the source of truth for a successful profile write.
 */
import assert from "node:assert/strict";

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
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
const listeners = new Map<string, Set<Listener>>();

class TestBroadcastChannel {
  readonly name: string;
  constructor(name: string) {
    this.name = name;
  }
  addEventListener(_type: string, listener: Listener) {
    const channelListeners = listeners.get(this.name) ?? new Set<Listener>();
    channelListeners.add(listener);
    listeners.set(this.name, channelListeners);
  }
  close() {}
  postMessage(data: unknown) {
    for (const listener of listeners.get(this.name) ?? []) {
      listener({ data } as MessageEvent);
    }
  }
  removeEventListener(_type: string, listener: Listener) {
    listeners.get(this.name)?.delete(listener);
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

test("a profile invalidation refetches authoritative data in every tab", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({
        profile: {
          id: "user-a",
          email: "user-a@example.com",
          fullName: "Shared Name",
          role: "student",
          status: "active",
        },
      }),
    ),
  );
  const primary = renderHook(() => useAuthSession());
  const peer = renderHook(() => useAuthSession());
  act(() => primary.result.current.applyLiveSession(liveSession));
  const peerGeneration = peer.result.current.sessionGeneration;
  const identity = {
    userId: "user-a",
    generation: primary.result.current.sessionGeneration,
  };

  await act(async () => {
    await primary.result.current.refreshLiveProfile(identity);
  });

  await waitFor(() => {
    assert.equal(peer.result.current.liveUser?.name, "Shared Name");
  });
  assert.equal(primary.result.current.liveUser?.name, "Shared Name");
  assert.equal(peer.result.current.sessionGeneration, peerGeneration);
});

test("an older authoritative refetch cannot overwrite a newer one", async () => {
  const resolvers: Array<(response: Response) => void> = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolvers.push(resolve);
        }),
    ),
  );
  const view = renderHook(() => useAuthSession());
  act(() => view.result.current.applyLiveSession(liveSession));
  const identity = {
    userId: "user-a",
    generation: view.result.current.sessionGeneration,
  };
  const first = view.result.current.refreshLiveProfile(identity, false);
  const second = view.result.current.refreshLiveProfile(identity, false);

  resolvers[1]?.(
    Response.json({
      profile: {
        id: "user-a",
        email: "user-a@example.com",
        fullName: "Database Winner",
        role: "student",
        status: "active",
      },
    }),
  );
  await act(async () => void (await second));
  resolvers[0]?.(
    Response.json({
      profile: {
        id: "user-a",
        email: "user-a@example.com",
        fullName: "Older Snapshot",
        role: "student",
        status: "active",
      },
    }),
  );
  await act(async () => void (await first));

  assert.equal(view.result.current.liveUser?.name, "Database Winner");
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
