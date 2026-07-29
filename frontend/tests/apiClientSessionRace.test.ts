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

let apiClient: ApiClient;
let authBridge: AuthBridge;

before(async () => {
  ({ apiClient } = await import("../src/lib/apiClient"));
  ({ authBridge } = await import("../src/lib/authBridge"));
});

test("does not refresh or retry after the initiating session changes", async () => {
  const originalFetch = globalThis.fetch;
  let currentToken = "token-a";
  let currentSession = { userId: "user-a", generation: 1 };
  let resolveInitialResponse!: (response: Response) => void;
  let refreshCalls = 0;
  const requests: Array<{ authorization: string | null; body: string | null }> = [];

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
    });
  };
  authBridge.configure({
    getAccessToken: () => currentToken,
    getSessionVersion: () => currentSession,
    refreshAccessToken: async () => {
      refreshCalls += 1;
      return { status: "refreshed", accessToken: currentToken };
    },
  });

  try {
    const request = apiClient("/me/profile", {
      method: "PATCH",
      body: { fullName: "Account A Draft" },
    });

    currentToken = "token-b";
    currentSession = { userId: "user-b", generation: 3 };
    resolveInitialResponse(
      new Response("", { status: 401, statusText: "Unauthorized" }),
    );

    await assert.rejects(request, (error: unknown) => {
      return (
        error instanceof Error &&
        (error as { status?: number }).status === 401
      );
    });
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
