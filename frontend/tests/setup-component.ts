/**
 * Location: tests/setup-component.ts
 * Purpose: Provide jsdom with the Web Locks boundary available in supported browsers.
 * Why: Component tests need an explicit coordination primitive while IndexedDB is absent.
 */

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
