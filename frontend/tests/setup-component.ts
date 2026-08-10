/**
 * Location: tests/setup-component.ts
 * Purpose: Provide jsdom with the Web Locks boundary available in supported browsers.
 * Why: Component tests need an explicit coordination primitive while IndexedDB is absent.
 */

import "fake-indexeddb/auto";
import { authBridge } from "../src/lib/authBridge";

const controller = new AbortController();
authBridge.configure({
  admit: () => ({
    accessToken: "component-test-access-token",
    actorId: "component-test-user",
    revision: 1,
    signal: controller.signal,
  }),
  isCurrent: () => true,
  getSnapshot: () => ({
    status: "authenticated",
    revision: 1,
    accessToken: "component-test-access-token",
    actor: { id: "component-test-user", role: "student" },
  }),
});

if (!navigator.locks) {
  Object.defineProperty(navigator, "locks", {
    configurable: true,
    value: {
      request: async (
        _name: string,
        _options: LockOptions,
        callback: () => Promise<unknown>,
      ) => callback(),
    },
  });
}
