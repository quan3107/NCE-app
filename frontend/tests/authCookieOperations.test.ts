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

test("refresh timeout fences the queue until active work settles", async () => {
  const operations = createAuthCookieOperations({ refreshTimeoutMs: 10 });
  let refreshSignal: AbortSignal | null = null;
  let releaseRefresh = () => undefined;
  const refreshReleased = new Promise<void>((resolve) => {
    releaseRefresh = resolve;
  });
  let queuedLogoutStarted = false;
  const refresh = operations.runRefresh(async (signal) => {
    refreshSignal = signal;
    await refreshReleased;
    return "refresh-complete";
  });
  const queuedLogout = operations.run(async () => {
    queuedLogoutStarted = true;
    return "logout-complete";
  });

  await assert.rejects(withDeadline(refresh), { name: "AbortError" });
  assert.equal(refreshSignal?.aborted, false);
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(queuedLogoutStarted, false);
  releaseRefresh();
  assert.equal(await withDeadline(queuedLogout), "logout-complete");
});

test("cancelling an active refresh fences the next cookie mutation", async () => {
  const operations = createAuthCookieOperations();
  let markRefreshStarted = () => undefined;
  const refreshStarted = new Promise<void>((resolve) => {
    markRefreshStarted = resolve;
  });
  let releaseRefresh = () => undefined;
  const refreshReleased = new Promise<void>((resolve) => {
    releaseRefresh = resolve;
  });
  let refreshWasSuperseded = false;
  let nextMutationStarted = false;
  const refresh = operations.runRefresh(
    async (signal, _compensate, isSuperseded) => {
      markRefreshStarted();
      await refreshReleased;
      assert.equal(signal.aborted, false);
      refreshWasSuperseded = isSuperseded();
      return "refresh-complete";
    },
  );
  await refreshStarted;

  operations.cancelRefreshes();
  const nextMutation = operations.run(async () => {
    nextMutationStarted = true;
    return "mutation-complete";
  });

  await assert.rejects(withDeadline(refresh), { name: "AbortError" });
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(nextMutationStarted, false);
  releaseRefresh();

  assert.equal(await withDeadline(nextMutation), "mutation-complete");
  assert.equal(refreshWasSuperseded, true);
});

test("generic timeout fences the queue until active work settles", async () => {
  const operations = createAuthCookieOperations({ operationTimeoutMs: 10 });
  const followingOperations = createAuthCookieOperations({
    operationTimeoutMs: 1_000,
  });
  let operationSignal: AbortSignal | null = null;
  let releaseLogin = () => undefined;
  const loginReleased = new Promise<void>((resolve) => {
    releaseLogin = resolve;
  });
  let queuedLogoutStarted = false;
  const stalledLogin = operations.run(async (signal) => {
    operationSignal = signal;
    await loginReleased;
    return "login-complete";
  });

  await assert.rejects(withDeadline(stalledLogin), { name: "AbortError" });
  assert.equal(operationSignal?.aborted, false);
  const queuedLogout = followingOperations.run(async () => {
    queuedLogoutStarted = true;
    return "logout-complete";
  });
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(queuedLogoutStarted, false);
  releaseLogin();
  assert.equal(await withDeadline(queuedLogout), "logout-complete");
});

test("operation timeout includes time spent in the local queue", async () => {
  const blockingOperations = createAuthCookieOperations({
    operationTimeoutMs: 1_000,
  });
  const expiringOperations = createAuthCookieOperations({
    operationTimeoutMs: 10,
  });
  let markBlockerStarted = () => undefined;
  const blockerStarted = new Promise<void>((resolve) => {
    markBlockerStarted = resolve;
  });
  let queuedOperationStarted = false;
  let releaseBlocker = () => undefined;
  const blockerReleased = new Promise<void>((resolve) => {
    releaseBlocker = resolve;
  });
  const stalledLogin = blockingOperations.run(async () => {
    markBlockerStarted();
    await blockerReleased;
    return "login-complete";
  });
  await blockerStarted;
  const queuedLogout = expiringOperations.run(async () => {
    queuedOperationStarted = true;
    return "logout-complete";
  });

  await assert.rejects(withDeadline(queuedLogout), { name: "AbortError" });
  assert.equal(queuedOperationStarted, false);
  releaseBlocker();
  assert.equal(await withDeadline(stalledLogin), "login-complete");
});

test("cookie compensation gets a fresh deadline after the operation expires", async () => {
  const operations = createAuthCookieOperations({ operationTimeoutMs: 10 });
  let markCompensated = () => undefined;
  const compensated = new Promise<void>((resolve) => {
    markCompensated = resolve;
  });
  let releaseOperation = () => undefined;
  const operationReleased = new Promise<void>((resolve) => {
    releaseOperation = resolve;
  });
  const operation = operations.run(async (_signal, compensate, isSuperseded) => {
    await operationReleased;
    assert.equal(isSuperseded(), true);
    await compensate(async (compensationSignal) => {
      assert.equal(compensationSignal.aborted, false);
      markCompensated();
    });
  });

  await assert.rejects(withDeadline(operation), { name: "AbortError" });
  releaseOperation();
  await withDeadline(compensated);
});

test("OAuth cancellation reports when active completion owns cleanup", async () => {
  const operations = createAuthCookieOperations();
  let markStarted = () => undefined;
  const started = new Promise<void>((resolve) => {
    markStarted = resolve;
  });
  let releaseCompletion = () => undefined;
  const completionReleased = new Promise<void>((resolve) => {
    releaseCompletion = resolve;
  });
  const completion = operations.runOAuthCompletion(async () => {
    markStarted();
    await completionReleased;
    return "completion-finished";
  });
  await started;

  assert.equal(operations.cancelOAuthCompletions(), true);
  await assert.rejects(withDeadline(completion), { name: "AbortError" });
  assert.equal(operations.cancelOAuthCompletions(), true);
  releaseCompletion();
  await withDeadline(operations.run(async () => "queue-drained"));
  assert.equal(operations.cancelOAuthCompletions(), false);
});
