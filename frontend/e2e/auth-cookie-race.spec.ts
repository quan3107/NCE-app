/**
 * Location: frontend/e2e/auth-cookie-race.spec.ts
 * Purpose: Verify cross-tab refresh and logout races converge to cookie authority.
 * Why: HttpOnly cookie ordering requires a real browser and HTTP server.
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
    await request.post(`${TEST_SERVER}/test/release-refresh`);
    await expect(pageB.getByTestId('current-user')).toHaveText('user-a');
    await request.post(`${TEST_SERVER}/test/reset`);

    const refreshStarted = pageA.waitForRequest('**/api/v1/auth/refresh');
    await pageA.getByRole('button', { name: 'Start protected request' }).click();
    await refreshStarted;

    await pageB.getByRole('button', { name: 'Login B' }).click();
    // The current authority remains visible while B waits behind the delayed
    // cookie refresh; only the serialized login response may replace it.
    await expect(pageB.getByTestId('current-user')).toHaveText('user-a');

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
  request,
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
  await request.post(`${TEST_SERVER}/test/release-refresh`);
  await expect(pageB.getByTestId('current-user')).toHaveText('user-a');
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
  const peer = await context.newPage();
  try {
    await Promise.all([
      page.goto('/e2e/auth-cookie-race.html'),
      peer.goto('/e2e/auth-cookie-race.html'),
    ]);
    await page.getByRole('button', { name: 'Login A' }).click();
    await expect(page.getByTestId('current-user')).toHaveText('user-a');
    await request.post(`${TEST_SERVER}/test/release-refresh`);
    await expect(peer.getByTestId('current-user')).toHaveText('user-a');
    await request.post(`${TEST_SERVER}/test/reset`);

    const refreshStarted = page.waitForRequest('**/api/v1/auth/refresh');
    await page.reload();
    await refreshStarted;
    await peer.getByRole('button', { name: 'Login B' }).click();
    await request.post(`${TEST_SERVER}/test/release-refresh`);

    await expect(peer.getByTestId('current-user')).toHaveText('user-b');
    await expect(page.getByTestId('current-user')).toHaveText('user-b');
  } finally {
    await request.post(`${TEST_SERVER}/test/release-refresh`);
    await context.close();
  }
});

test('logout completion clears a fresh peer whose refresh queued first', async ({
  browser,
  request,
}) => {
  const context = await browser.newContext();
  const logoutPage = await context.newPage();
  const blockerPage = await context.newPage();
  const peerPage = await context.newPage();
  try {
    await Promise.all([
      logoutPage.goto('/e2e/auth-cookie-race.html'),
      blockerPage.goto('/e2e/auth-cookie-lock.html'),
    ]);
    await expect(logoutPage.getByTestId('restoring')).toHaveText('false');
    await logoutPage.getByRole('button', { name: 'Login A' }).click();
    await expect(logoutPage.getByTestId('current-user')).toHaveText('user-a');

    // Hold the shared cookie lock with an already-admitted operation. Logout
    // publishes immediately, but its lock request is paused so the fresh peer's
    // bootstrap refresh deterministically enters the FIFO Web Lock queue first.
    await blockerPage.evaluate(() => {
      const state = window as typeof window & {
        cookieOperationLockHeld?: boolean;
        releaseCookieOperation?: () => void;
      };
      state.cookieOperationLockHeld = false;
      void import('/src/lib/auth-cookie-operations.ts').then(
        ({ createAuthCookieOperations }) =>
          createAuthCookieOperations().run(async () => {
            state.cookieOperationLockHeld = true;
            await new Promise<void>((resolve) => {
              state.releaseCookieOperation = resolve;
            });
          }),
      );
    });
    await expect
      .poll(() =>
        blockerPage.evaluate(
          () =>
            (window as typeof window & { cookieOperationLockHeld?: boolean })
              .cookieOperationLockHeld,
        ),
      )
      .toBe(true);

    await logoutPage.evaluate(() => {
      const locks = navigator.locks;
      const originalRequest = locks.request.bind(locks);
      const state = window as typeof window & {
        logoutLockForwarded?: boolean;
        releaseLogoutLockRequest?: () => void;
      };
      let releaseRequest!: () => void;
      const requestGate = new Promise<void>((resolve) => {
        releaseRequest = resolve;
      });
      let delayNextRequest = true;
      Object.defineProperty(locks, 'request', {
        configurable: true,
        value: async (
          name: string,
          options: LockOptions,
          callback: (lock: Lock | null) => Promise<unknown>,
        ) => {
          if (name === 'nce-auth-cookie-operations' && delayNextRequest) {
            delayNextRequest = false;
            await requestGate;
            state.logoutLockForwarded = true;
          }
          return originalRequest(name, options, callback);
        },
      });
      state.logoutLockForwarded = false;
      state.releaseLogoutLockRequest = releaseRequest;
    });

    let logoutRequests = 0;
    logoutPage.on('request', (outgoing) => {
      if (outgoing.url().endsWith('/api/v1/auth/logout')) logoutRequests += 1;
    });
    await logoutPage.getByRole('button', { name: 'Logout' }).click();
    await expect(logoutPage.getByTestId('current-user')).toHaveText('guest');

    await peerPage.addInitScript(() => {
      const locks = navigator.locks;
      const originalRequest = locks.request.bind(locks);
      const state = window as typeof window & { authLockRequests?: number };
      state.authLockRequests = 0;
      Object.defineProperty(locks, 'request', {
        configurable: true,
        value: (
          name: string,
          options: LockOptions,
          callback: (lock: Lock | null) => Promise<unknown>,
        ) => {
          if (name === 'nce-auth-cookie-operations') {
            state.authLockRequests = (state.authLockRequests ?? 0) + 1;
          }
          return originalRequest(name, options, callback);
        },
      });
    });
    await peerPage.goto('/e2e/auth-cookie-race.html');
    await expect
      .poll(() =>
        peerPage.evaluate(
          () =>
            (window as typeof window & { authLockRequests?: number })
              .authLockRequests,
        ),
      )
      .toBe(1);

    await logoutPage.evaluate(() =>
      (
        window as typeof window & { releaseLogoutLockRequest?: () => void }
      ).releaseLogoutLockRequest?.(),
    );
    await expect
      .poll(() =>
        logoutPage.evaluate(
          () =>
            (window as typeof window & { logoutLockForwarded?: boolean })
              .logoutLockForwarded,
        ),
      )
      .toBe(true);
    expect(logoutRequests).toBe(0);

    const peerRefresh = peerPage.waitForRequest('**/api/v1/auth/refresh');
    const logoutResponse = logoutPage.waitForResponse('**/api/v1/auth/logout');
    await blockerPage.evaluate(() =>
      (
        window as typeof window & { releaseCookieOperation?: () => void }
      ).releaseCookieOperation?.(),
    );
    await peerRefresh;
    expect(logoutRequests).toBe(0);
    await request.post(`${TEST_SERVER}/test/release-refresh`);
    await expect(logoutPage.getByTestId('current-user')).toHaveText('guest');
    expect((await logoutResponse).status()).toBe(204);

    const cookieRefreshStatus = await peerPage.evaluate(() =>
      fetch('http://127.0.0.1:4010/api/v1/auth/refresh', {
        method: 'POST',
        credentials: 'include',
      }).then((response) => response.status),
    );
    expect(cookieRefreshStatus).toBe(401);
    await expect(peerPage.getByTestId('current-user')).toHaveText('guest');
    await expect(peerPage.getByTestId('authenticated')).toHaveText('false');
    await expect(peerPage.getByTestId('restoring')).toHaveText('false');
  } finally {
    await request.post(`${TEST_SERVER}/test/release-refresh`);
    await logoutPage
      .evaluate(() =>
        (
          window as typeof window & { releaseLogoutLockRequest?: () => void }
        ).releaseLogoutLockRequest?.(),
      )
      .catch(() => undefined);
    await blockerPage
      .evaluate(() =>
        (
          window as typeof window & { releaseCookieOperation?: () => void }
        ).releaseCookieOperation?.(),
      )
      .catch(() => undefined);
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
  await expect(page.getByTestId('switch-status')).toHaveText('switching');
  await expect(page.getByTestId('current-user')).toHaveText('guest');
  await request.post(`${TEST_SERVER}/test/release-refresh`);
  await expect(page.getByTestId('switch-status')).toHaveText('complete');
  await expect(page.getByTestId('current-user')).toHaveText('user-b');

  await page.getByRole('button', { name: 'Restore B session' }).click();
  await expect(page.getByTestId('restore-status')).toHaveText('success');
  await expect(page.getByTestId('current-user')).toHaveText('user-b');
});
