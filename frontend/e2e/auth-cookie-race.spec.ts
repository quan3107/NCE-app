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
  disableWebLocks = false,
) {
  const context = await browser.newContext();
  if (disableWebLocks) {
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'locks', {
        configurable: true,
        value: undefined,
      });
    });
  }
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

test('serializes cross-tab cookie writes without Web Locks', async ({
  browser,
  request,
}) => {
  await verifyDelayedCrossTabSwitch(browser, request, true);
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

test('timed-out login cannot overwrite a later account cookie', async ({
  page,
  request,
}) => {
  await page.goto('/e2e/auth-cookie-race.html');

  const result = await page.evaluate(async () => {
    const { createAuthCookieOperations } = await import(
      '/src/lib/auth-cookie-operations.ts'
    );
    const operations = createAuthCookieOperations({ operationTimeoutMs: 50 });
    const login = (email: string) =>
      operations.run((signal) =>
        fetch('http://127.0.0.1:4010/api/v1/auth/login', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password: 'password' }),
          signal,
        }),
      );
    const delayedA = login('delayed-a@example.com');
    const loginB = login('b@example.com');
    let timedOut = false;
    try {
      await delayedA;
    } catch (error) {
      timedOut = error instanceof Error && error.name === 'AbortError';
    }
    const responseB = await loginB;
    return { timedOut, loginBStatus: responseB.status };
  });

  expect(result).toEqual({ timedOut: true, loginBStatus: 200 });
  await request.post(`${TEST_SERVER}/test/release-login`);
  await page.waitForTimeout(100);

  const refreshedUser = await page.evaluate(async () => {
    const response = await fetch(
      'http://127.0.0.1:4010/api/v1/auth/refresh',
      { method: 'POST', credentials: 'include' },
    );
    return (await response.json()) as { user: { id: string } };
  });
  expect(refreshedUser.user.id).toBe('user-b');
});

test('timed-out logout cannot clear a later account cookie', async ({
  page,
  request,
}) => {
  await page.goto('/e2e/auth-cookie-race.html');

  const result = await page.evaluate(async () => {
    const { createAuthCookieOperations } = await import(
      '/src/lib/auth-cookie-operations.ts'
    );
    const operations = createAuthCookieOperations({ operationTimeoutMs: 50 });
    const authRequest = (path: string, body?: unknown) =>
      operations.run((signal) =>
        fetch(`http://127.0.0.1:4010/api/v1/auth/${path}`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: body ? JSON.stringify(body) : undefined,
          signal,
        }),
      );
    await authRequest('login', {
      email: 'a@example.com',
      password: 'password',
    });
    const delayedLogout = authRequest('logout?delay=true');
    const loginB = authRequest('login', {
      email: 'b@example.com',
      password: 'password',
    });
    let timedOut = false;
    try {
      await delayedLogout;
    } catch (error) {
      timedOut = error instanceof Error && error.name === 'AbortError';
    }
    const responseB = await loginB;
    return { timedOut, loginBStatus: responseB.status };
  });

  expect(result).toEqual({ timedOut: true, loginBStatus: 200 });
  await request.post(`${TEST_SERVER}/test/release-logout`);
  await page.waitForTimeout(100);

  const refreshedUser = await page.evaluate(async () => {
    const response = await fetch(
      'http://127.0.0.1:4010/api/v1/auth/refresh',
      { method: 'POST', credentials: 'include' },
    );
    return (await response.json()) as { user: { id: string } };
  });
  expect(refreshedUser.user.id).toBe('user-b');
});
