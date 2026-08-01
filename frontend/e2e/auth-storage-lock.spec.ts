/**
 * Location: frontend/e2e/auth-storage-lock.spec.ts
 * Purpose: Verify cookie mutations fail closed when Web Locks are unavailable.
 * Why: IndexedDB cannot fence a Set-Cookie response after the browser commits it.
 */

import { expect, test, type Browser } from '@playwright/test';

type StorageFailureMode = 'access' | 'enumeration' | 'read' | 'write';

async function expectUnavailableOperation(
  browser: Browser,
  failureMode: StorageFailureMode,
): Promise<void> {
  const context = await browser.newContext();
  await context.addInitScript((mode) => {
    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: undefined,
    });
    if (mode === 'access') {
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        get() {
          throw new DOMException('Storage denied', 'SecurityError');
        },
      });
    } else if (mode === 'read') {
      Storage.prototype.getItem = () => {
        throw new DOMException('Storage read denied', 'SecurityError');
      };
    } else if (mode === 'write') {
      Storage.prototype.setItem = () => {
        throw new DOMException('Storage write denied', 'QuotaExceededError');
      };
    } else {
      const storage = window.localStorage;
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        value: new Proxy(storage, {
          ownKeys() {
            throw new DOMException('Storage enumeration denied', 'SecurityError');
          },
        }),
      });
    }
  }, failureMode);
  const page = await context.newPage();
  await page.goto('/e2e/auth-cookie-race.html');

  const result = await page.evaluate(async () => {
    const { createAuthCookieOperations } = await import(
      '/src/lib/auth-cookie-operations.ts'
    );
    let entered = false;
    try {
      await createAuthCookieOperations().run(async () => {
        entered = true;
      });
      return { entered, errorName: null };
    } catch (error) {
      return {
        entered,
        errorName: error instanceof Error ? error.name : 'UnknownError',
      };
    }
  });

  expect(result).toEqual({
    entered: false,
    errorName: 'AuthCoordinationUnavailableError',
  });
  await context.close();
}

for (const failureMode of [
  'access',
  'write',
  'read',
  'enumeration',
] as const) {
  test(`fails closed without Web Locks during storage ${failureMode}`, async ({
    browser,
  }) => {
    await expectUnavailableOperation(browser, failureMode);
  });
}

test('does not create an OAuth reservation without Web Locks', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: undefined,
    });
  });
  await page.goto('/e2e/auth-cookie-race.html');

  const result = await page.evaluate(async () => {
    const { createAuthCookieOperations } = await import(
      '/src/lib/auth-cookie-operations.ts'
    );
    const operations = createAuthCookieOperations();
    try {
      await operations.runOAuthStart(async () => 'authorization-url');
      return { errorName: null, ownsLease: operations.hasOwnedOAuthLease() };
    } catch (error) {
      return {
        errorName: error instanceof Error ? error.name : 'UnknownError',
        ownsLease: operations.hasOwnedOAuthLease(),
      };
    }
  });

  expect(result).toEqual({
    errorName: 'AuthCoordinationUnavailableError',
    ownsLease: false,
  });
});
