/**
 * Location: tests/authCookieOperations.test.ts
 * Purpose: Verify hung refresh work cannot hold the cookie operation queue.
 * Why: Logout and account changes need a bounded path past stalled requests.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createAuthCookieOperations } from "../src/lib/auth-cookie-operations";

function withDeadline<T>(promise: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("Cookie operation remained blocked")),
      250,
    );
    promise.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

test("refresh timeout aborts work and releases the cookie queue", async () => {
  const operations = createAuthCookieOperations({ refreshTimeoutMs: 10 });
  let refreshSignal: AbortSignal | null = null;
  const refresh = operations.runRefresh(async (signal) => {
    refreshSignal = signal;
    return new Promise<string>(() => undefined);
  });
  const queuedLogout = operations.run(async () => "logout-complete");

  await assert.rejects(withDeadline(refresh), { name: "AbortError" });
  assert.equal(refreshSignal?.aborted, true);
  assert.equal(await withDeadline(queuedLogout), "logout-complete");
});

test("generic cookie operation timeout aborts work and releases the queue", async () => {
  const operations = createAuthCookieOperations({ operationTimeoutMs: 10 });
  let operationSignal: AbortSignal | null = null;
  const stalledLogin = operations.run(async (signal) => {
    operationSignal = signal;
    return new Promise<string>(() => undefined);
  });

  await assert.rejects(withDeadline(stalledLogin), { name: "AbortError" });
  assert.equal(operationSignal?.aborted, true);
  const queuedLogout = operations.run(async () => "logout-complete");
  assert.equal(await withDeadline(queuedLogout), "logout-complete");
});

test("operation timeout includes time spent in the local queue", async () => {
  const operations = createAuthCookieOperations({ operationTimeoutMs: 20 });
  let queuedOperationStarted = false;
  const stalledLogin = operations.run(
    async () => new Promise<string>(() => undefined),
  );
  const queuedLogout = operations.run(async () => {
    queuedOperationStarted = true;
    return "logout-complete";
  });

  await assert.rejects(withDeadline(stalledLogin), { name: "AbortError" });
  await assert.rejects(withDeadline(queuedLogout), { name: "AbortError" });
  assert.equal(queuedOperationStarted, false);
});
