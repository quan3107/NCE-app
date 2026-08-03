/**
 * Location: tests/sharedAuthNotificationFailure.component.test.tsx
 * Purpose: Verify auth commits and removal fallbacks survive notification failures.
 * Why: Every peer must retire old authority even when BroadcastChannel fails.
 */
import assert from "node:assert/strict";

import { afterEach, beforeEach, test, vi } from "vitest";

let localValues: Map<string, string>;
let sessionValues: Map<string, string>;

beforeEach(() => {
  vi.resetModules();
  localValues = new Map<string, string>();
  sessionValues = new Map<string, string>();
  const storage = (values: Map<string, string>) => ({
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => values.set(key, value),
  });
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: storage(localValues),
  });
  Object.defineProperty(window, "sessionStorage", {
    configurable: true,
    value: storage(sessionValues),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test("BroadcastChannel construction failure does not interrupt login persistence", async () => {
  vi.stubGlobal(
    "BroadcastChannel",
    class {
      constructor() {
        throw new DOMException("Channel unavailable", "NotSupportedError");
      }
    },
  );
  const { persistSharedAuthSnapshot } = await import(
    "../src/lib/shared-auth-session"
  );

  const result = persistSharedAuthSnapshot(
    {
      token: "student-token",
      liveUser: {
        id: "student-a",
        name: "Student A",
        email: "student-a@example.com",
        role: "student",
      },
    },
    0,
    true,
    { token: null, liveUser: null },
  );

  assert.equal(result.status, "committed");
  assert.match(localValues.get("currentUser") ?? "", /student-token/);
});

test("BroadcastChannel publication failure does not interrupt logout persistence", async () => {
  localValues.set(
    "currentUser",
    JSON.stringify({
      sessionEpoch: 5,
      profileRevision: 0,
      token: "admin-token",
      liveUser: {
        id: "admin-a",
        name: "Admin A",
        email: "admin-a@example.com",
        role: "admin",
      },
    }),
  );
  vi.stubGlobal(
    "BroadcastChannel",
    class {
      addEventListener() {}
      close() {}
      postMessage() {
        throw new DOMException("Channel closed", "InvalidStateError");
      }
      removeEventListener() {}
    },
  );
  const { authenticatedRequestSignal, persistSharedAuthSnapshot } = await import(
    "../src/lib/shared-auth-session"
  );
  const requestSignal = authenticatedRequestSignal();

  const result = persistSharedAuthSnapshot(
    { token: null, liveUser: null },
    5,
    true,
    {
      token: "admin-token",
      liveUser: {
        id: "admin-a",
        name: "Admin A",
        email: "admin-a@example.com",
        role: "admin",
      },
    },
  );

  assert.equal(result.status, "committed");
  assert.equal(JSON.parse(localValues.get("currentUser") ?? "{}").token, null);
  assert.equal(requestSignal.aborted, true);
});

test("volatile logout reaches peers through an ordered removal tombstone", async () => {
  const previousSerialized = JSON.stringify({
    sessionEpoch: 5,
    profileRevision: 0,
    token: "admin-token",
    liveUser: {
      id: "admin-a",
      name: "Admin A",
      email: "admin-a@example.com",
      role: "admin",
    },
  });
  localValues.set("currentUser", previousSerialized);
  const failingStorage = (values: Map<string, string>) => ({
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => values.delete(key),
    setItem: () => {
      throw new DOMException("Storage write denied", "QuotaExceededError");
    },
  });
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: failingStorage(localValues),
  });
  Object.defineProperty(window, "sessionStorage", {
    configurable: true,
    value: failingStorage(sessionValues),
  });
  vi.stubGlobal(
    "BroadcastChannel",
    class {
      addEventListener() {}
      close() {}
      postMessage() {
        throw new DOMException("Channel closed", "InvalidStateError");
      }
      removeEventListener() {}
    },
  );
  const { persistSharedAuthSnapshot, subscribeToSharedAuth } = await import(
    "../src/lib/shared-auth-session"
  );
  const consumed: unknown[] = [];
  const unsubscribe = subscribeToSharedAuth(5, (snapshot) => {
    consumed.push(snapshot);
  });

  const result = persistSharedAuthSnapshot(
    { token: null, liveUser: null },
    5,
    true,
    JSON.parse(previousSerialized),
  );
  window.dispatchEvent(
    new StorageEvent("storage", {
      key: "currentUser",
      oldValue: previousSerialized,
      newValue: null,
    }),
  );

  assert.equal(result.status, "volatile");
  assert.equal(localValues.get("currentUser"), undefined);
  assert.equal(sessionValues.get("currentUser"), undefined);
  assert.deepEqual(consumed, [
    {
      sessionEpoch: 6,
      profileRevision: 0,
      token: null,
      liveUser: null,
    },
  ]);
  unsubscribe();
});

test("a delayed removal tombstone cannot replace a newer peer session", async () => {
  vi.stubGlobal("BroadcastChannel", undefined);
  const { subscribeToSharedAuth } = await import(
    "../src/lib/shared-auth-session"
  );
  const consumed: unknown[] = [];
  const unsubscribe = subscribeToSharedAuth(10, (snapshot) => {
    consumed.push(snapshot);
  });

  window.dispatchEvent(
    new StorageEvent("storage", {
      key: "currentUser",
      oldValue: JSON.stringify({
        sessionEpoch: 5,
        profileRevision: 0,
        token: "old-token",
        liveUser: {
          id: "old-user",
          name: "Old User",
          email: "old@example.com",
          role: "admin",
        },
      }),
      newValue: null,
    }),
  );

  assert.deepEqual(consumed, []);
  unsubscribe();
});
