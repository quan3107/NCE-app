/**
 * Location: tests/authCoordinationUnavailable.component.test.tsx
 * Purpose: Verify cookie writes fail closed without trustworthy cross-tab coordination.
 * Why: An uncoordinated Set-Cookie response can replace a newer account session.
 */
import assert from "node:assert/strict";

import { afterEach, beforeEach, expect, test } from "vitest";

import { createAuthCookieOperations } from "../src/lib/auth-cookie-operations";
import {
  removeIndexedDbAuthLease,
  writeIndexedDbAuthLease,
} from "../src/lib/auth-cookie-indexeddb-lock";

const originalLocalStorage = Object.getOwnPropertyDescriptor(window, "localStorage");
const originalSessionStorage = Object.getOwnPropertyDescriptor(window, "sessionStorage");
const originalLocks = Object.getOwnPropertyDescriptor(navigator, "locks");
const originalIndexedDb = Object.getOwnPropertyDescriptor(globalThis, "indexedDB");

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
  for (const [target, key, descriptor] of [
    [window, "localStorage", originalLocalStorage],
    [window, "sessionStorage", originalSessionStorage],
    [navigator, "locks", originalLocks],
    [globalThis, "indexedDB", originalIndexedDb],
  ] as const) {
    if (descriptor) Object.defineProperty(target, key, descriptor);
    else Reflect.deleteProperty(target, key);
  }
});

test("fails closed when every cross-tab lock boundary is unavailable", async () => {
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    get() {
      throw new DOMException("Storage denied", "SecurityError");
    },
  });
  Object.defineProperty(navigator, "locks", { configurable: true, value: undefined });
  Object.defineProperty(globalThis, "indexedDB", { configurable: true, value: undefined });

  await expect(
    createAuthCookieOperations().run(async () => "complete"),
  ).rejects.toMatchObject({ name: "AuthCoordinationUnavailableError" });
});

test("never starts a cookie request without Web Locks", async () => {
  Object.defineProperty(navigator, "locks", { configurable: true, value: undefined });
  let requestStarted = false;

  await expect(
    createAuthCookieOperations().run(async () => {
      requestStarted = true;
      return "unsafe-response";
    }),
  ).rejects.toMatchObject({ name: "AuthCoordinationUnavailableError" });
  assert.equal(requestStarted, false);
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
  let entered = false;

  try {
    await expect(
      createAuthCookieOperations().run(async () => {
        entered = true;
      }),
    ).rejects.toMatchObject({ name: "AuthCoordinationUnavailableError" });
    assert.equal(entered, false);
  } finally {
    await removeIndexedDbAuthLease("oauth-reservation", ownerId);
  }
});
