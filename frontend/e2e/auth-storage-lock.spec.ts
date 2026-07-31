/**
 * Location: frontend/e2e/auth-storage-lock.spec.ts
 * Purpose: Exercise the storage-independent auth-cookie lock in two pages.
 * Why: Web Locks and localStorage failures must never permit concurrent cookie writes.
 */

import { expect, test, type Browser } from "@playwright/test";

type StorageFailureMode = "access" | "enumeration" | "read" | "write";

async function expectSerializedOperations(
  browser: Browser,
  failureMode: StorageFailureMode,
): Promise<void> {
  const context = await browser.newContext();
  await context.addInitScript((mode) => {
    Object.defineProperty(navigator, "locks", {
      configurable: true,
      value: undefined,
    });
    if (mode === "access") {
      Object.defineProperty(window, "localStorage", {
        configurable: true,
        get() {
          throw new DOMException("Storage denied", "SecurityError");
        },
      });
      return;
    }
    if (mode === "read") {
      Storage.prototype.getItem = () => {
        throw new DOMException("Storage read denied", "SecurityError");
      };
      return;
    }
    if (mode === "enumeration") {
      const storage = window.localStorage;
      Object.defineProperty(window, "localStorage", {
        configurable: true,
        value: new Proxy(storage, {
          get(target, property) {
            const value = Reflect.get(target, property, target);
            return typeof value === "function"
              ? value.bind(target)
              : value;
          },
          ownKeys() {
            throw new DOMException(
              "Storage enumeration denied",
              "SecurityError",
            );
          },
        }),
      });
      return;
    }
    if (mode === "write") {
      Storage.prototype.setItem = () => {
        throw new DOMException(
          "Storage write denied",
          "QuotaExceededError",
        );
      };
    }
  }, failureMode);
  const firstPage = await context.newPage();
  const secondPage = await context.newPage();
  await Promise.all([
    firstPage.goto("/e2e/auth-cookie-race.html"),
    secondPage.goto("/e2e/auth-cookie-race.html"),
  ]);

  await firstPage.evaluate(async () => {
    const { createAuthCookieOperations } = await import(
      "/src/lib/auth-cookie-operations.ts"
    );
    const state = (window as Window & {
      authLockEntered?: boolean;
      authLockReleased?: boolean;
      authLockDone?: boolean;
    });
    state.authLockEntered = false;
    state.authLockReleased = false;
    state.authLockDone = false;
    void createAuthCookieOperations()
      .run(async () => {
        state.authLockEntered = true;
        while (!state.authLockReleased) {
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
      })
      .then(() => {
        state.authLockDone = true;
      });
  });
  await expect
    .poll(() =>
      firstPage.evaluate(
        () =>
          (window as Window & { authLockEntered?: boolean })
            .authLockEntered,
      ),
    )
    .toBe(true);

  await secondPage.evaluate(async () => {
    const { createAuthCookieOperations } = await import(
      "/src/lib/auth-cookie-operations.ts"
    );
    const state = (window as Window & {
      authLockEntered?: boolean;
      authLockDone?: boolean;
    });
    state.authLockEntered = false;
    state.authLockDone = false;
    void createAuthCookieOperations()
      .run(async () => {
        state.authLockEntered = true;
      })
      .then(() => {
        state.authLockDone = true;
      });
  });
  await secondPage.waitForTimeout(100);
  expect(
    await secondPage.evaluate(
      () =>
        (window as Window & { authLockEntered?: boolean })
          .authLockEntered,
    ),
  ).toBe(false);

  await firstPage.evaluate(() => {
    (window as Window & { authLockReleased?: boolean }).authLockReleased =
      true;
  });
  await expect
    .poll(() =>
      secondPage.evaluate(
        () =>
          (window as Window & { authLockDone?: boolean }).authLockDone,
      ),
    )
    .toBe(true);
  await expect
    .poll(() =>
      firstPage.evaluate(
        () =>
          (window as Window & { authLockDone?: boolean }).authLockDone,
      ),
    )
    .toBe(true);
  await context.close();
}

test("serializes tabs when localStorage access is denied", async ({
  browser,
}) => {
  await expectSerializedOperations(browser, "access");
});

test("serializes tabs when localStorage writes fail", async ({ browser }) => {
  await expectSerializedOperations(browser, "write");
});

test("serializes tabs when localStorage reads fail", async ({ browser }) => {
  await expectSerializedOperations(browser, "read");
});

test("serializes tabs when localStorage enumeration fails", async ({
  browser,
}) => {
  await expectSerializedOperations(browser, "enumeration");
});

test("holds the OAuth reservation when localStorage reads fail", async ({
  browser,
}) => {
  const context = await browser.newContext();
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "locks", {
      configurable: true,
      value: undefined,
    });
    const storage = window.localStorage;
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: new Proxy(storage, {
        get(target, property) {
          if (property === "getItem") {
            return () => {
              throw new DOMException(
                "Storage read denied",
                "SecurityError",
              );
            };
          }
          const value = Reflect.get(target, property, target);
          return typeof value === "function"
            ? value.bind(target)
            : value;
        },
      }),
    });
  });
  const oauthPage = await context.newPage();
  const otherPage = await context.newPage();
  await Promise.all([
    oauthPage.goto("/e2e/auth-cookie-race.html"),
    otherPage.goto("/e2e/auth-cookie-race.html"),
  ]);

  await oauthPage.evaluate(async () => {
    const { createAuthCookieOperations } = await import(
      "/src/lib/auth-cookie-operations.ts"
    );
    await createAuthCookieOperations().runOAuthStart(
      async () => "authorization-url",
    );
  });
  await otherPage.evaluate(async () => {
    const { createAuthCookieOperations } = await import(
      "/src/lib/auth-cookie-operations.ts"
    );
    const state = (window as Window & { authOperationDone?: boolean });
    state.authOperationDone = false;
    void createAuthCookieOperations().run(async () => {
      state.authOperationDone = true;
    });
  });
  await otherPage.waitForTimeout(100);
  expect(
    await otherPage.evaluate(
      () =>
        (window as Window & { authOperationDone?: boolean })
          .authOperationDone,
    ),
  ).toBe(false);

  await oauthPage.evaluate(async () => {
    const { createAuthCookieOperations } = await import(
      "/src/lib/auth-cookie-operations.ts"
    );
    await createAuthCookieOperations().runOAuthCompletion(
      async () => undefined,
    );
  });
  await expect
    .poll(() =>
      otherPage.evaluate(
        () =>
          (window as Window & { authOperationDone?: boolean })
            .authOperationDone,
      ),
    )
    .toBe(true);
  await context.close();
});
