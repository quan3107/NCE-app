/**
 * Location: tests/setup-component.ts
 * Purpose: Provide jsdom with browser coordination and pointer primitives used by the UI.
 * Why: Component tests exercise Web Locks and Radix controls that jsdom does not implement.
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

if (!HTMLElement.prototype.hasPointerCapture) {
  HTMLElement.prototype.hasPointerCapture = () => false;
  HTMLElement.prototype.setPointerCapture = () => undefined;
  HTMLElement.prototype.releasePointerCapture = () => undefined;
}

if (!HTMLElement.prototype.scrollIntoView) {
  HTMLElement.prototype.scrollIntoView = () => undefined;
}
