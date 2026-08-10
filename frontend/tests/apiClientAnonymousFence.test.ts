/**
 * Location: tests/apiClientAnonymousFence.test.ts
 * Purpose: Verify optional anonymous requests retain session fencing.
 * Why: Public data admitted before login must not return into the new session.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { apiClient } from "../src/lib/apiClient";
import { AuthCoordinator } from "../src/lib/auth-coordinator";
import { authBridge } from "../src/lib/authBridge";

test("anonymous optional work aborts when login changes the session", async () => {
  const coordinator = new AuthCoordinator();
  coordinator.finishBootstrap();
  authBridge.configure({
    waitUntilReady: () => coordinator.waitUntilReady(),
    admit: (mode) => coordinator.admit(mode),
    isCurrent: (value) => coordinator.isCurrent(value),
  });
  let requestSignal: AbortSignal | undefined;
  let requestStarted!: () => void;
  const started = new Promise<void>((resolve) => {
    requestStarted = resolve;
  });
  let releaseResponse!: () => void;
  const responseGate = new Promise<void>((resolve) => {
    releaseResponse = resolve;
  });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_input, init) => {
    requestSignal = init?.signal ?? undefined;
    requestStarted();
    await responseGate;
    return Response.json({ visibility: "public-before-login" });
  };

  try {
    const request = apiClient<{ visibility: string }>(
      "http://localhost:4000/api/v1/public-course",
      { auth: "optional" },
    );
    await started;
    coordinator.authenticate("login-token", {
      id: "user-after-login",
      role: "student",
    });
    assert.equal(requestSignal?.aborted, true);
    releaseResponse();
    await assert.rejects(request, /session changed/i);
  } finally {
    globalThis.fetch = originalFetch;
    authBridge.reset();
  }
});
