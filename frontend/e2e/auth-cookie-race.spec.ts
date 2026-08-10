/**
 * Location: frontend/e2e/auth-cookie-race.spec.ts
 * Purpose: Verify stale refresh responses cannot replace a new account cookie.
 * Why: HttpOnly Set-Cookie races require a real browser and HTTP server.
 */

import { expect, test, type APIRequestContext, type Browser } from '@playwright/test';

const TEST_SERVER = 'http://127.0.0.1:4010';

test.beforeEach(async ({ request }) => {
  await request.post(`${TEST_SERVER}/test/reset`);
});

async function verifyDelayedCrossTabSwitch(
  browser: Browser,
  request: APIRequestContext,
) {
  const context = await browser.newContext();
  const pageA = await context.newPage();
  const pageB = await context.newPage();
  try {
    await Promise.all([
      pageA.goto('/e2e/auth-cookie-race.html'),
      pageB.goto('/e2e/auth-cookie-race.html'),
    ]);

    await pageA.getByRole('button', { name: 'Login A' }).click();
    await expect(pageA.getByTestId('current-user')).toHaveText('user-a');

    const refreshStarted = pageA.waitForRequest('**/api/v1/auth/refresh');
    await pageA.getByRole('button', { name: 'Start protected request' }).click();
    await refreshStarted;

    await pageB.getByRole('button', { name: 'Login B' }).click();
    // Peer notification cannot grant A's authority while B waits behind the
    // delayed cookie refresh; only the server response may authenticate it.
    await expect(pageB.getByTestId('current-user')).toHaveText('guest');

    await request.post(`${TEST_SERVER}/test/release-refresh`);
    await expect(pageB.getByTestId('current-user')).toHaveText('user-b');

    await pageB.reload();
    await expect(pageB.getByTestId('current-user')).toHaveText('user-b');
  } finally {
    await context.close();
  }
}

test('serializes a delayed refresh and account switch across two pages', async ({
  browser,
  request,
}) => {
  await verifyDelayedCrossTabSwitch(browser, request);
});

test('refuses cookie writes without Web Locks', async ({
  browser,
}) => {
  const context = await browser.newContext();
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: undefined,
    });
  });
  const page = await context.newPage();
  await page.goto('/e2e/auth-cookie-race.html');

  const result = await page.evaluate(async () => {
    const { createAuthCookieOperations } = await import(
      '/src/lib/auth-cookie-operations.ts'
    );
    let requestStarted = false;
    try {
      await createAuthCookieOperations().run(async () => {
        requestStarted = true;
        return fetch('http://127.0.0.1:4010/api/v1/auth/login', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'a@example.com',
            password: 'password',
          }),
        });
      });
      return { errorName: null, requestStarted };
    } catch (error) {
      return {
        errorName: error instanceof Error ? error.name : 'UnknownError',
        requestStarted,
      };
    }
  });

  expect(result).toEqual({
    errorName: 'AuthCoordinationUnavailableError',
    requestStarted: false,
  });
  const refreshStatus = await page.evaluate(async () =>
    fetch('http://127.0.0.1:4010/api/v1/auth/refresh', {
      method: 'POST',
      credentials: 'include',
    }).then((response) => response.status),
  );
  expect(refreshStatus).toBe(401);
  await context.close();
});

test('refresh reconciles a tab to the shared cookie identity', async ({
  browser,
}) => {
  const context = await browser.newContext();
  const pageA = await context.newPage();
  const pageB = await context.newPage();
  await Promise.all([
    pageA.goto('/e2e/auth-cookie-race.html'),
    pageB.goto('/e2e/auth-cookie-race.html'),
  ]);

  await pageA.getByRole('button', { name: 'Login A' }).click();
  await expect(pageA.getByTestId('current-user')).toHaveText('user-a');
  await pageB.getByRole('button', { name: 'Login B' }).click();
  await expect(pageB.getByTestId('current-user')).toHaveText('user-b');

  await pageA.getByRole('button', { name: 'Start protected request' }).click();
  await expect(pageA.getByTestId('current-user')).toHaveText('user-b');
  await context.close();
});

test('invalidation during bootstrap starts a fresh revision refresh', async ({
  browser,
  request,
}) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await page.goto('/e2e/auth-cookie-race.html');
    await page.getByRole('button', { name: 'Login A' }).click();
    await expect(page.getByTestId('current-user')).toHaveText('user-a');

    const refreshStarted = page.waitForRequest('**/api/v1/auth/refresh');
    await page.reload();
    await refreshStarted;
    const switchCookie = await context.request.post(
      `${TEST_SERVER}/api/v1/auth/login`,
      { data: { email: 'b@example.com', password: 'password' } },
    );
    expect(switchCookie.ok()).toBeTruthy();
    await page.evaluate(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'nce:auth-invalidation',
          newValue: JSON.stringify({
            schemaVersion: 1,
            epoch: Date.now(),
            reason: 'account-change',
            nonce: 'peer-bootstrap-race:1',
          }),
        }),
      );
    });

    await expect(page.getByTestId('current-user')).toHaveText('user-b');
  } finally {
    await request.post(`${TEST_SERVER}/test/release-refresh`);
    await context.close();
  }
});

test('holds cross-tab cookie operations until OAuth completion', async ({
  browser,
}) => {
  const context = await browser.newContext();
  const oauthPage = await context.newPage();
  const otherPage = await context.newPage();
  await Promise.all([
    oauthPage.goto('/e2e/auth-cookie-race.html'),
    otherPage.goto('/e2e/auth-cookie-race.html'),
  ]);

  await oauthPage.evaluate(async () => {
    const { createAuthCookieOperations } = await import(
      '/src/lib/auth-cookie-operations.ts'
    );
    const operations = createAuthCookieOperations();
    await operations.runOAuthStart(async () => 'authorization-url');
  });
  await otherPage.evaluate(async () => {
    const { createAuthCookieOperations } = await import(
      '/src/lib/auth-cookie-operations.ts'
    );
    const operations = createAuthCookieOperations();
    (window as Window & { authOperationDone?: boolean }).authOperationDone = false;
    void operations.run(async () => {
      (window as Window & { authOperationDone?: boolean }).authOperationDone = true;
    });
  });

  await expect
    .poll(() =>
      otherPage.evaluate(
        () => (window as Window & { authOperationDone?: boolean }).authOperationDone,
      ),
    )
    .toBe(false);

  await oauthPage.evaluate(async () => {
    const { createAuthCookieOperations } = await import(
      '/src/lib/auth-cookie-operations.ts'
    );
    const operations = createAuthCookieOperations();
    await operations.runOAuthCompletion(async () => undefined);
  });
  await expect
    .poll(() =>
      otherPage.evaluate(
        () => (window as Window & { authOperationDone?: boolean }).authOperationDone,
      ),
    )
    .toBe(true);
  await context.close();
});

test('cancels refresh before logout and preserves the new account cookie', async ({
  page,
  request,
}) => {
  await page.goto('/e2e/auth-cookie-race.html');
  await page.getByRole('button', { name: 'Login A' }).click();
  await expect(page.getByTestId('current-user')).toHaveText('user-a');

  const refreshStarted = page.waitForRequest('**/api/v1/auth/refresh');
  await page.getByRole('button', { name: 'Start protected request' }).click();
  await refreshStarted;

  await page.getByRole('button', { name: 'Switch to B' }).click();
  await expect(page.getByTestId('switch-status')).toHaveText('complete');
  await expect(page.getByTestId('current-user')).toHaveText('user-b');

  await request.post(`${TEST_SERVER}/test/release-refresh`);

  await page.getByRole('button', { name: 'Restore B session' }).click();
  await expect(page.getByTestId('restore-status')).toHaveText('success');
  await expect(page.getByTestId('current-user')).toHaveText('user-b');
});
