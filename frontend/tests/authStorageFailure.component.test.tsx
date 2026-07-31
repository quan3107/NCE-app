/**
 * Location: tests/authStorageFailure.component.test.tsx
 * Purpose: Verify auth operations survive unavailable browser persistence.
 * Why: Storage failures must not prevent login coordination or server logout.
 */
import assert from "node:assert/strict";
import type { PropsWithChildren } from "react";

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { AuthProvider, useAuth } from "../src/lib/auth";
import { createAuthCookieOperations } from "../src/lib/auth-cookie-operations";
import {
  readIndexedDbAuthLease,
  removeIndexedDbAuthLease,
  runWithIndexedDbAuthLock,
  writeIndexedDbAuthLease,
} from "../src/lib/auth-cookie-indexeddb-lock";
import { authBridge } from "../src/lib/authBridge";
import { queryClient } from "../src/lib/queryClient";

const originalLocalStorageDescriptor = Object.getOwnPropertyDescriptor(
  window,
  "localStorage",
);
const originalSessionStorageDescriptor = Object.getOwnPropertyDescriptor(
  window,
  "sessionStorage",
);
const originalLocksDescriptor = Object.getOwnPropertyDescriptor(
  navigator,
  "locks",
);
const originalIndexedDbDescriptor = Object.getOwnPropertyDescriptor(
  globalThis,
  "indexedDB",
);

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
  if (originalLocalStorageDescriptor) {
    Object.defineProperty(
      window,
      "localStorage",
      originalLocalStorageDescriptor,
    );
  } else {
    Reflect.deleteProperty(window, "localStorage");
  }
  if (originalSessionStorageDescriptor) {
    Object.defineProperty(
      window,
      "sessionStorage",
      originalSessionStorageDescriptor,
    );
  } else {
    Reflect.deleteProperty(window, "sessionStorage");
  }
  if (originalLocksDescriptor) {
    Object.defineProperty(navigator, "locks", originalLocksDescriptor);
  } else {
    Reflect.deleteProperty(navigator, "locks");
  }
  if (originalIndexedDbDescriptor) {
    Object.defineProperty(
      globalThis,
      "indexedDB",
      originalIndexedDbDescriptor,
    );
  } else {
    Reflect.deleteProperty(globalThis, "indexedDB");
  }
});

test("fails closed when every cross-tab lock boundary is unavailable", async () => {
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    get() {
      throw new DOMException("Storage denied", "SecurityError");
    },
  });
  Object.defineProperty(navigator, "locks", {
    configurable: true,
    value: undefined,
  });
  Object.defineProperty(globalThis, "indexedDB", {
    configurable: true,
    value: undefined,
  });
  const operations = createAuthCookieOperations();

  await expect(operations.run(async () => "complete")).rejects.toMatchObject({
    name: "AuthCoordinationUnavailableError",
  });
});

test("fails closed when an active OAuth lease has unreadable ownership", async () => {
  const ownerId = "other-tab";
  await writeIndexedDbAuthLease({
    name: "oauth-reservation",
    ownerId,
    expiresAt: Date.now() + 60_000,
  });
  Object.defineProperty(window, "sessionStorage", {
    configurable: true,
    get() {
      throw new DOMException("Storage denied", "SecurityError");
    },
  });
  const operations = createAuthCookieOperations();
  let entered = false;

  try {
    await expect(
      operations.run(async () => {
        entered = true;
      }),
    ).rejects.toMatchObject({
      name: "AuthCoordinationUnavailableError",
    });
    assert.equal(entered, false);
  } finally {
    await removeIndexedDbAuthLease("oauth-reservation", ownerId);
  }
});

test("server logout still runs when cleared-session persistence fails", async () => {
  const values = new Map<string, string>();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      clear: () => values.clear(),
      getItem: (key: string) => values.get(key) ?? null,
      removeItem: (key: string) => values.delete(key),
      setItem: () => {
        throw new DOMException("Quota exceeded", "QuotaExceededError");
      },
    },
  });
  Object.defineProperty(navigator, "locks", {
    configurable: true,
    value: {
      request: async (
        _name: string,
        _options: LockOptions,
        callback: () => Promise<unknown>,
      ) => callback(),
    },
  });
  const fetchSpy = vi.fn(async () => new Response(null, { status: 204 }));
  vi.stubGlobal("fetch", fetchSpy);
  const wrapper = ({ children }: PropsWithChildren) => (
    <AuthProvider>{children}</AuthProvider>
  );
  const view = renderHook(() => useAuth(), { wrapper });

  await act(async () => {
    await view.result.current.logout();
  });

  assert.equal(fetchSpy.mock.calls.length, 1);
  assert.match(String(fetchSpy.mock.calls[0]?.[0]), /\/auth\/logout$/);
  assert.equal(view.result.current.isAuthenticated, false);
});

test("an owned OAuth lease can be released on a terminal cancellation", async () => {
  const operations = createAuthCookieOperations();
  await operations.runOAuthStart(async () => "started");
  assert.equal(operations.hasOwnedOAuthLease(), true);

  await operations.releaseOAuthLease();

  assert.equal(operations.hasOwnedOAuthLease(), false);
});

test("a password fallback releases its tab's abandoned OAuth lease", async () => {
  const operations = createAuthCookieOperations({ operationTimeoutMs: 250 });
  await operations.runOAuthStart(async () => "started");

  await expect(operations.run(async () => "password-login")).resolves.toBe(
    "password-login",
  );
  assert.equal(operations.hasOwnedOAuthLease(), false);
});

test("OAuth admission wait consumes refresh and logout deadlines", async () => {
  const operations = createAuthCookieOperations({
    operationTimeoutMs: 10,
    refreshTimeoutMs: 10,
  });
  const runners = [
    operations.runRefresh.bind(operations),
    operations.run.bind(operations),
  ];

  for (const run of runners) {
    const ownerId = crypto.randomUUID();
    await writeIndexedDbAuthLease({
      name: "oauth-reservation",
      ownerId,
      expiresAt: Date.now() + 75,
    });
    let networkStarted = false;

    try {
      await expect(
        run(async (signal) => {
          networkStarted = true;
          assert.equal(signal.aborted, false);
          return "network-complete";
        }),
      ).rejects.toMatchObject({ name: "AbortError" });
      assert.equal(networkStarted, false);
    } finally {
      await removeIndexedDbAuthLease("oauth-reservation", ownerId);
    }
  }
});

test("cancellation interrupts an IndexedDB open that never completes", async () => {
  Object.defineProperty(globalThis, "indexedDB", {
    configurable: true,
    value: {
      open: () => ({}),
    },
  });
  const controller = new AbortController();
  const readWithSignal = readIndexedDbAuthLease as (
    name: string,
    signal: AbortSignal,
  ) => Promise<unknown>;
  const read = readWithSignal("blocked-read", controller.signal);
  controller.abort();

  await expect(
    Promise.race([
      read,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("IndexedDB read stayed blocked")), 100),
      ),
    ]),
  ).rejects.toMatchObject({ name: "AbortError" });
});

test("an active IndexedDB writer renews its lease", async () => {
  let now = Date.now();
  vi.spyOn(Date, "now").mockImplementation(() => now);
  let releaseWriter!: () => void;
  let writerStarted = false;
  const writer = runWithIndexedDbAuthLock(
    new AbortController().signal,
    60_000,
    async () => {
      writerStarted = true;
      await new Promise<void>((resolve) => {
        releaseWriter = resolve;
      });
      return "writer-complete";
    },
  );
  await waitFor(() => assert.equal(writerStarted, true));

  now += 61_000;
  await new Promise((resolve) => setTimeout(resolve, 1_100));
  let secondWriterStarted = false;
  const secondWriter = runWithIndexedDbAuthLock(
    new AbortController().signal,
    60_000,
    async () => {
      secondWriterStarted = true;
      return "second-complete";
    },
  );

  try {
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(secondWriterStarted, false);
  } finally {
    releaseWriter();
  }
  await expect(writer).resolves.toBe("writer-complete");
  await expect(secondWriter).resolves.toBe("second-complete");
});

test("an IndexedDB writer rejects a result after losing its fence", async () => {
  let releaseWriter!: () => void;
  let writerStarted = false;
  const writer = runWithIndexedDbAuthLock(
    new AbortController().signal,
    60_000,
    async () => {
      writerStarted = true;
      await new Promise<void>((resolve) => {
        releaseWriter = resolve;
      });
      return "stale-result";
    },
  );
  await waitFor(() => assert.equal(writerStarted, true));
  await writeIndexedDbAuthLease({
    name: "auth-cookie-operations",
    ownerId: "new-owner",
    expiresAt: Date.now() + 60_000,
  });
  releaseWriter();

  try {
    await expect(writer).rejects.toMatchObject({ name: "AbortError" });
  } finally {
    await removeIndexedDbAuthLease("auth-cookie-operations", "new-owner");
  }
});

test("mount cleanup releases an abandoned OAuth lease before restoring", async () => {
  const initial = {
    token: "stale-token",
    liveUser: {
      id: "user-a",
      name: "User A",
      email: "user-a@example.com",
      role: "student",
    },
  };
  window.localStorage.setItem("currentUser", JSON.stringify(initial));
  const operations = createAuthCookieOperations();
  await operations.runOAuthStart(async () => "started");
  const fetchSpy = vi.fn(async () =>
    Response.json({
      accessToken: "fresh-token",
      user: {
        id: "user-a",
        fullName: "User A",
        email: "user-a@example.com",
        role: "student",
      },
    }),
  );
  vi.stubGlobal("fetch", fetchSpy);
  const wrapper = ({ children }: PropsWithChildren) => (
    <AuthProvider>{children}</AuthProvider>
  );

  renderHook(() => useAuth(), { wrapper });

  await waitFor(() => assert.equal(fetchSpy.mock.calls.length, 1));
  assert.match(String(fetchSpy.mock.calls[0]?.[0]), /\/auth\/refresh$/);
});
