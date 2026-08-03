/**
 * Location: tests/authOAuthLeaseDeadline.component.test.tsx
 * Purpose: Verify OAuth lease cleanup has a hard browser-operation deadline.
 * Why: A stalled IndexedDB open must not hang auth restoration indefinitely.
 */
import { afterEach, expect, test } from "vitest";

import { createAuthCookieOperations } from "../src/lib/auth-cookie-operations";

const originalIndexedDb = Object.getOwnPropertyDescriptor(
  globalThis,
  "indexedDB",
);

afterEach(() => {
  if (originalIndexedDb) {
    Object.defineProperty(globalThis, "indexedDB", originalIndexedDb);
  } else {
    Reflect.deleteProperty(globalThis, "indexedDB");
  }
});

test("bounds lease cleanup when IndexedDB open stalls", async () => {
  Object.defineProperty(globalThis, "indexedDB", {
    configurable: true,
    value: { open: () => ({}) },
  });
  const operations = createAuthCookieOperations({ operationTimeoutMs: 10 });

  await expect(operations.releaseOAuthLease()).rejects.toMatchObject({
    name: "AbortError",
  });
});
