/**
 * Location: tests/sharedAuthPersistenceFailure.component.test.tsx
 * Purpose: Verify epoch fencing survives complete browser-storage failure.
 * Why: Logout must abort local bearer work and notify other tabs without persistence.
 */
import assert from "node:assert/strict";

import { afterEach, test, vi } from "vitest";

const originalLocalStorage = Object.getOwnPropertyDescriptor(
  window,
  "localStorage",
);
const originalSessionStorage = Object.getOwnPropertyDescriptor(
  window,
  "sessionStorage",
);

afterEach(() => {
  vi.unstubAllGlobals();
  for (const [key, descriptor] of [
    ["localStorage", originalLocalStorage],
    ["sessionStorage", originalSessionStorage],
  ] as const) {
    if (descriptor) Object.defineProperty(window, key, descriptor);
    else Reflect.deleteProperty(window, key);
  }
});

test("unavailable persistence publishes only reducing transitions", async () => {
  const rejectedStorage = {
    getItem: () => null,
    removeItem: () => undefined,
    setItem: () => {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
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
  const posted: unknown[] = [];
  class TestBroadcastChannel {
    addEventListener() {}
    close() {}
    postMessage(value: unknown) {
      posted.push(value);
    }
    removeEventListener() {}
  }
  vi.stubGlobal("BroadcastChannel", TestBroadcastChannel);
  const { authenticatedRequestSignal, persistSharedAuthSnapshot } =
    await import("../src/lib/shared-auth-session");
  const loginSignal = authenticatedRequestSignal();

  const loginResult = persistSharedAuthSnapshot(
    {
      token: "login-token",
      liveUser: {
        id: "user-a",
        name: "User A",
        email: "user-a@example.com",
        role: "student",
      },
    },
    0,
    true,
    { token: null, liveUser: null },
  );

  assert.equal(loginResult.status, "unavailable");
  assert.equal(loginSignal.aborted, false);
  assert.deepEqual(posted, []);

  const logoutResult = persistSharedAuthSnapshot(
    { token: null, liveUser: null },
    7,
    true,
    { token: null, liveUser: null },
  );

  assert.equal(logoutResult.status, "unavailable");
  assert.equal(loginSignal.aborted, true);
  assert.deepEqual(posted, [logoutResult.snapshot]);

  const previousAdmin = {
    token: "admin-token",
    liveUser: {
      id: "user-a",
      name: "User A",
      email: "user-a@example.com",
      role: "admin",
    },
  } as const;
  const downgradeSignal = authenticatedRequestSignal();
  const downgradeResult = persistSharedAuthSnapshot(
    {
      token: "student-token",
      liveUser: {
        id: "user-a",
        name: "User A",
        email: "user-a@example.com",
        role: "student",
      },
    },
    20,
    true,
    previousAdmin,
  );

  assert.equal(downgradeResult.status, "unavailable");
  assert.equal(downgradeSignal.aborted, true);
  assert.deepEqual(posted, [logoutResult.snapshot, downgradeResult.snapshot]);
});
