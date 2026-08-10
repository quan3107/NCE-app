/// <reference lib="dom" />
/**
 * Location: tests/ieltsConfigPublic.api.test.ts
 * Purpose: Verify public IELTS config operations work without auth authority.
 * Why: These endpoints declare OpenAPI security: [] and must not await bootstrap.
 */
import assert from "node:assert/strict";
import { before, test } from "node:test";

const API_BASE_URL = "http://localhost:4000/api/v1";
let fetchIeltsConfig: typeof import("../src/features/ielts-config/api").fetchIeltsConfig;
let fetchIeltsConfigVersions: typeof import("../src/features/ielts-config/api").fetchIeltsConfigVersions;
let authBridge: typeof import("../src/lib/authBridge").authBridge;

before(async () => {
  process.env.VITE_API_BASE_URL = API_BASE_URL;
  const configApi = await import("../src/features/ielts-config/api");
  fetchIeltsConfig = configApi.fetchIeltsConfig;
  fetchIeltsConfigVersions = configApi.fetchIeltsConfigVersions;
  authBridge = (await import("../src/lib/authBridge")).authBridge;
});

test("current/versioned config and version listing are anonymously fetchable", async () => {
  authBridge.reset();
  const paths: string[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    paths.push(`${url.pathname}${url.search}`);
    assert.equal(new Headers(init?.headers).get("authorization"), null);
    if (url.pathname.endsWith("/versions")) {
      return Response.json({ versions: [] });
    }
    return Response.json({ version: 3 });
  };

  try {
    await fetchIeltsConfig();
    await fetchIeltsConfig(3);
    await fetchIeltsConfigVersions();
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.deepEqual(paths, [
    "/api/v1/config/ielts",
    "/api/v1/config/ielts?version=3",
    "/api/v1/config/ielts/versions",
  ]);
});
