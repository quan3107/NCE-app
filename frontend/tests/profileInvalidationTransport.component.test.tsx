/**
 * Location: tests/profileInvalidationTransport.component.test.tsx
 * Purpose: Verify profile invalidation transport fallback and identifier isolation.
 * Why: Mixed browser capabilities must not miss or duplicate authoritative refetches.
 */
import assert from "node:assert/strict";

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, test, vi } from "vitest";

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

const profileResponse = (fullName: string) =>
  Response.json({
    profile: {
      id: "user-a",
      email: "user-a@example.com",
      fullName,
      role: "student",
      status: "active",
    },
  });

test("a storage event refetches peers when BroadcastChannel is unavailable", async () => {
  vi.stubGlobal("BroadcastChannel", undefined);
  const values = new Map<string, string>();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      clear: () => values.clear(),
      getItem: (key: string) => values.get(key) ?? null,
      removeItem: (key: string) => values.delete(key),
      setItem: (key: string, value: string) => {
        values.set(key, value);
        if (key === "nce:auth-profile-invalidation") {
          window.dispatchEvent(
            new StorageEvent("storage", { key, newValue: value }),
          );
        }
      },
    },
  });
  vi.stubGlobal("fetch", vi.fn(async () => profileResponse("Fallback Name")));
  const primary = renderHook(() => useAuthSession());
  act(() => primary.result.current.applyLiveSession(liveSession));
  const peer = renderHook(() => useAuthSession());
  act(() => peer.result.current.applyLiveSession(liveSession));
  act(() => primary.result.current.applyLiveSession(liveSession));

  await act(async () => {
    await primary.result.current.refreshLiveProfile({
      userId: "user-a",
      generation: primary.result.current.sessionGeneration,
    });
  });

  await waitFor(() => {
    assert.equal(peer.result.current.liveUser?.name, "Fallback Name");
  });
});

test("mixed-capability peers receive one refetch through both transports", async () => {
  const values = new Map<string, string>();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      clear: () => values.clear(),
      getItem: (key: string) => values.get(key) ?? null,
      removeItem: (key: string) => values.delete(key),
      setItem: (key: string, value: string) => {
        values.set(key, value);
        if (key === "nce:auth-profile-invalidation") {
          window.dispatchEvent(
            new StorageEvent("storage", { key, newValue: value }),
          );
        }
      },
    },
  });
  const fetchProfile = vi.fn(async () =>
    profileResponse("Mixed Transport Name"),
  );
  vi.stubGlobal("fetch", fetchProfile);
  const primary = renderHook(() => useAuthSession());
  act(() => primary.result.current.applyLiveSession(liveSession));
  const peer = renderHook(() => useAuthSession());
  act(() => peer.result.current.applyLiveSession(liveSession));
  act(() => primary.result.current.applyLiveSession(liveSession));

  await act(async () => {
    await primary.result.current.refreshLiveProfile({
      userId: "user-a",
      generation: primary.result.current.sessionGeneration,
    });
  });

  await waitFor(() => {
    assert.equal(peer.result.current.liveUser?.name, "Mixed Transport Name");
    assert.equal(fetchProfile.mock.calls.length, 3);
  });
  assert.ok(values.get("nce:auth-profile-invalidation"));
});

test("fallback publication IDs remain unique across tab runtimes", async () => {
  vi.stubGlobal("BroadcastChannel", undefined);
  let entropy = 0;
  vi.stubGlobal("crypto", {
    getRandomValues: (array: Uint32Array) => {
      entropy += 1;
      array.fill(entropy);
      return array;
    },
  });
  const fixedNow = vi.spyOn(Date, "now").mockReturnValue(1_800_000_000_000);
  const publicationIds: string[] = [];
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      clear: () => undefined,
      getItem: () => null,
      removeItem: () => undefined,
      setItem: (key: string, value: string) => {
        if (key === "nce:auth-profile-invalidation") {
          publicationIds.push(
            (JSON.parse(value) as { publicationId: string }).publicationId,
          );
        }
      },
    },
  });

  vi.resetModules();
  const firstTab = await import("../src/lib/shared-profile-invalidation");
  firstTab.publishProfileInvalidation({ userId: "user-a", sessionEpoch: 1 });
  vi.resetModules();
  const secondTab = await import("../src/lib/shared-profile-invalidation");
  secondTab.publishProfileInvalidation({ userId: "user-a", sessionEpoch: 1 });
  fixedNow.mockRestore();

  assert.equal(publicationIds.length, 2);
  assert.notEqual(publicationIds[0], publicationIds[1]);
});
