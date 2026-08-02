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

test("unavailable logout persistence still aborts and broadcasts", async () => {
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
  const requestSignal = authenticatedRequestSignal();

  const result = persistSharedAuthSnapshot(
    { token: null, liveUser: null },
    7,
    true,
  );

  assert.equal(result.status, "unavailable");
  assert.equal(requestSignal.aborted, true);
  assert.deepEqual(posted, [result.snapshot]);
});
