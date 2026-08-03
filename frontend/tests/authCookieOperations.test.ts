/**
 * Location: tests/authCookieOperations.test.ts
 * Purpose: Verify cookie-operation timeouts, queue release, and cancellation ownership.
 * Why: Logout and account changes need bounded, single-owner cleanup paths.
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
  const blockingOperations = createAuthCookieOperations({
    operationTimeoutMs: 80,
  });
  const expiringOperations = createAuthCookieOperations({
    operationTimeoutMs: 10,
  });
  let markBlockerStarted = () => undefined;
  const blockerStarted = new Promise<void>((resolve) => {
    markBlockerStarted = resolve;
  });
  let queuedOperationStarted = false;
  const stalledLogin = blockingOperations.run(async () => {
    markBlockerStarted();
    return new Promise<string>(() => undefined);
  });
  await blockerStarted;
  const queuedLogout = expiringOperations.run(async () => {
    queuedOperationStarted = true;
    return "logout-complete";
  });

  await assert.rejects(withDeadline(queuedLogout), { name: "AbortError" });
  assert.equal(queuedOperationStarted, false);
  await assert.rejects(withDeadline(stalledLogin), { name: "AbortError" });
});

test("cookie compensation gets a fresh deadline after the operation expires", async () => {
  const operations = createAuthCookieOperations({ operationTimeoutMs: 10 });
  let markCompensated = () => undefined;
  const compensated = new Promise<void>((resolve) => {
    markCompensated = resolve;
  });
  const operation = operations.run(async (signal, compensate) => {
    await new Promise<void>((resolve) => {
      signal.addEventListener("abort", () => resolve(), { once: true });
    });
    await compensate(async (compensationSignal) => {
      assert.equal(compensationSignal.aborted, false);
      markCompensated();
    });
  });

  await assert.rejects(withDeadline(operation), { name: "AbortError" });
  await withDeadline(compensated);
});

test("OAuth cancellation reports when active completion owns cleanup", async () => {
  const operations = createAuthCookieOperations();
  let markStarted = () => undefined;
  const started = new Promise<void>((resolve) => {
    markStarted = resolve;
  });
  const completion = operations.runOAuthCompletion(async (signal) => {
    markStarted();
    await new Promise<void>((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(signal.reason), {
        once: true,
      });
    });
    return "unreachable";
  });
  await started;

  assert.equal(operations.cancelOAuthCompletions(), true);
  await assert.rejects(withDeadline(completion), { name: "AbortError" });
  assert.equal(operations.cancelOAuthCompletions(), false);
});
