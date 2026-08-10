/**
 * Location: tests/setup-component.ts
 * Purpose: Provide jsdom with the Web Locks boundary available in supported browsers.
 * Why: Component tests need an explicit coordination primitive while IndexedDB is absent.
 */

import "fake-indexeddb/auto";
import { authBridge } from "../src/lib/authBridge";

authBridge.configure({
  getAccessToken: () => "component-test-access-token",
  getSessionVersion: () => ({
    generation: 1,
    sessionEpoch: 1,
    userId: "component-test-user",
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
