/**
 * Location: tests/apiClientSessionRace.test.ts
 * Purpose: Verify retries remain bound to the request's initiating session.
 * Why: Account-A mutations must never replay with account-B credentials.
 */

import assert from "node:assert/strict";
import test, { before } from "node:test";

process.env.VITE_API_BASE_URL = "http://localhost:4000/api/v1";

type ApiClient = typeof import("../src/lib/apiClient").apiClient;
type AuthBridge = typeof import("../src/lib/authBridge").authBridge;
type AuthCoordinatorConstructor =
  typeof import("../src/lib/auth-coordinator").AuthCoordinator;

let apiClient: ApiClient;
let authBridge: AuthBridge;
let AuthCoordinator: AuthCoordinatorConstructor;

before(async () => {
  ({ apiClient } = await import("../src/lib/apiClient"));
  ({ authBridge } = await import("../src/lib/authBridge"));
  ({ AuthCoordinator } = await import("../src/lib/auth-coordinator"));
});

test("a remounted provider rejects the retiring provider's matching admission", async () => {
  const originalFetch = globalThis.fetch;
  const retiring = new AuthCoordinator();
  const replacement = new AuthCoordinator();
  for (const coordinator of [retiring, replacement]) {
    coordinator.finishBootstrap();
    coordinator.authenticate("same-token", {
      id: "same-user",
      role: "student",
    });
  }
  let resolveResponse!: (response: Response) => void;
  let markStarted!: () => void;
  const started = new Promise<void>((resolve) => {
    markStarted = resolve;
  });
  globalThis.fetch = async () =>
    new Promise<Response>((resolve) => {
      resolveResponse = resolve;
      markStarted();
    });
  const configure = (coordinator: InstanceType<AuthCoordinatorConstructor>) =>
    authBridge.configure({
      admit: (mode) => coordinator.admit(mode),
      isCurrent: (candidate) => coordinator.isCurrent(candidate),
      waitUntilReady: () => coordinator.waitUntilReady(),
      getSnapshot: () => coordinator.getSnapshot(),
    });
  configure(retiring);

  try {
    const request = apiClient("/me", { auth: "required" });
    await started;
    configure(replacement);
    resolveResponse(Response.json({ profile: { id: "same-user" } }));

    await assert.rejects(request, /session changed/i);
  } finally {
    retiring.dispose?.();
    replacement.dispose?.();
    authBridge.reset();
    globalThis.fetch = originalFetch;
  }
});

test("a reset bridge rejects an authenticated response already in flight", async () => {
  const originalFetch = globalThis.fetch;
  const coordinator = new AuthCoordinator();
  coordinator.finishBootstrap();
  coordinator.authenticate("token-a", { id: "user-a", role: "student" });
  let resolveResponse!: (response: Response) => void;
  let markStarted!: () => void;
  const started = new Promise<void>((resolve) => {
    markStarted = resolve;
  });
  globalThis.fetch = async () =>
    new Promise<Response>((resolve) => {
      resolveResponse = resolve;
      markStarted();
    });
  authBridge.configure({
    admit: (mode) => coordinator.admit(mode),
    isCurrent: (candidate) => coordinator.isCurrent(candidate),
    waitUntilReady: () => coordinator.waitUntilReady(),
  });

  try {
    const request = apiClient("/me", { auth: "required" });
    await started;
    authBridge.reset();
    resolveResponse(Response.json({ profile: { id: "user-a" } }));

    await assert.rejects(request, /session changed/i);
  } finally {
    coordinator.dispose();
    authBridge.reset();
    globalThis.fetch = originalFetch;
  }
});

test("does not refresh or retry after the initiating session changes", async () => {
  const originalFetch = globalThis.fetch;
  let currentToken = "token-a";
  let currentSession = { userId: "user-a", revision: 1 };
  const signal = new AbortController().signal;
  let resolveInitialResponse!: (response: Response) => void;
  let markFetchStarted!: () => void;
  const fetchStarted = new Promise<void>((resolve) => {
    markFetchStarted = resolve;
  });
  let refreshCalls = 0;
  const requests: Array<{ authorization: string | null; body: string | null }> =
    [];

  globalThis.fetch = async (_input, init) => {
    requests.push({
      authorization: new Headers(init?.headers).get("authorization"),
      body: typeof init?.body === "string" ? init.body : null,
    });
    if (requests.length > 1) {
      return Response.json({ id: "user-b", fullName: "Account A Draft" });
    }
    return new Promise<Response>((resolve) => {
      resolveInitialResponse = resolve;
      markFetchStarted();
    });
  };
  authBridge.configure({
    admit: () => ({
      accessToken: currentToken,
      actorId: currentSession.userId,
      revision: currentSession.revision,
      signal,
    }),
    isCurrent: (candidate) =>
      candidate.actorId === currentSession.userId &&
      candidate.revision === currentSession.revision,
    refreshAccessToken: async () => {
      refreshCalls += 1;
      return { status: "refreshed", accessToken: currentToken };
    },
  });

  try {
    const request = apiClient("/me/profile", {
      auth: "required",
      method: "PATCH",
      body: { fullName: "Account A Draft" },
    });

    await fetchStarted;

    currentToken = "token-b";
    currentSession = { userId: "user-b", revision: 3 };
    resolveInitialResponse(
      new Response("", { status: 401, statusText: "Unauthorized" }),
    );

    await assert.rejects(request, (error: unknown) =>
      Boolean(
        error instanceof Error &&
        (error as { status?: number }).status === 0 &&
        /session changed/i.test(error.message),
      ),
    );
    assert.equal(refreshCalls, 0);
    assert.deepEqual(requests, [
      {
        authorization: "Bearer token-a",
        body: JSON.stringify({ fullName: "Account A Draft" }),
      },
    ]);
  } finally {
    authBridge.reset();
    globalThis.fetch = originalFetch;
  }
});
