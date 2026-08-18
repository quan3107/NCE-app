/**
 * Location: frontend/e2e/real-backend-oauth.spec.ts
 * Purpose: Verify Google OAuth success and recovery through the local provider.
 * Why: Real browser redirects must cover PKCE/state without external credentials.
 */
import { expect, test, type BrowserContext, type Page } from '@playwright/test';

const frontendOrigin = 'http://127.0.0.1:3010';
const backendOrigin = 'http://127.0.0.1:4000';
const apiBaseURL = `${backendOrigin}/api/v1`;
const temporaryCookieNames = new Set([
  'googleOAuthState',
  'googleOAuthVerifier',
  'googleOAuthReturnTo',
]);

async function expectTemporaryCookiesCleared(context: BrowserContext) {
  const cookies = await context.cookies(`${apiBaseURL}/auth/google/callback`);
  expect(cookies.filter((cookie) => temporaryCookieNames.has(cookie.name))).toEqual([]);
}

async function revokeContextSession(context: BrowserContext) {
  await context.request.post(`${apiBaseURL}/auth/logout`, { data: {} });
}

async function beginGoogleSignIn(page: Page) {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Continue with Google' }).click();
  await expect(page).toHaveURL(
    new RegExp(`^${backendOrigin}/api/v1/auth/google/test-provider\\?`),
  );
  await expect(page.getByRole('heading', { name: 'Local Google OAuth fixture' })).toBeVisible();
}

async function logoutFromShell(page: Page) {
  await page
    .locator('header button')
    .filter({ has: page.locator('[data-slot="avatar"]') })
    .click();
  await page.getByRole('menuitem', { name: 'Logout' }).click();
  await expect(page).toHaveURL(/\/login$/);
}

for (const account of [
  { role: 'Student', landing: '/student/dashboard' },
  { role: 'Teacher', landing: '/teacher/dashboard' },
  { role: 'Admin', landing: '/admin/dashboard' },
] as const) {
  test(`local OAuth creates one ${account.role.toLowerCase()} session`, async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const remoteProviderRequests: string[] = [];
    let callbackUrl = '';
    page.on('request', (request) => {
      const url = request.url();
      if (/accounts\.google\.com|oauth2\.googleapis\.com|www\.googleapis\.com\/oauth2/.test(url)) {
        remoteProviderRequests.push(url);
      }
      const candidate = new URL(url);
      if (
        candidate.pathname === '/api/v1/auth/google/callback' &&
        candidate.searchParams.has('code')
      ) {
        callbackUrl = url;
      }
    });

    try {
      await beginGoogleSignIn(page);
      await page.getByRole('link', { name: `Continue as ${account.role}` }).click();
      await expect(page).toHaveURL(new RegExp(`${account.landing}$`));
      expect(remoteProviderRequests).toEqual([]);
      expect(callbackUrl).toContain('state=');
      await expectTemporaryCookiesCleared(context);

      const refreshCookies = (
        await context.cookies(`${apiBaseURL}/auth/refresh`)
      ).filter((cookie) => cookie.name === 'refreshToken');
      expect(refreshCookies).toHaveLength(1);
      const replay = await context.request.get(callbackUrl, { maxRedirects: 0 });
      expect(replay.status()).toBe(400);
      await logoutFromShell(page);
    } finally {
      await revokeContextSession(context);
      await context.close();
    }
  });
}

test('cancellation and token failure clear artifacts and remain retryable', async ({
  browser,
}) => {
  for (const failureLink of ['Cancel sign-in', 'Simulate token failure']) {
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await beginGoogleSignIn(page);
      await page.getByRole('link', { name: failureLink }).click();
      await expect(
        page.getByRole('heading', { name: 'Google sign-in could not complete' }),
      ).toBeVisible();
      await expectTemporaryCookiesCleared(context);
      expect(
        (await context.cookies(`${apiBaseURL}/auth/refresh`)).some(
          (cookie) => cookie.name === 'refreshToken',
        ),
      ).toBe(false);

      await page.getByRole('button', { name: 'Return to login' }).click();
      await page.getByRole('button', { name: 'Continue with Google' }).click();
      await page.getByRole('link', { name: 'Continue as Student' }).click();
      await expect(page).toHaveURL(/\/student\/dashboard$/);
      await logoutFromShell(page);
    } finally {
      await revokeContextSession(context);
      await context.close();
    }
  }
});

test('missing or mismatched callback state fails without a session', async ({ browser }) => {
  for (const state of [null, 'mismatched-state-value']) {
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await beginGoogleSignIn(page);
      const callback = new URL(`${apiBaseURL}/auth/google/callback`);
      callback.searchParams.set('code', 'nce_test_invalid_code');
      if (state) callback.searchParams.set('state', state);
      await page.goto(callback.toString());

      await expect(
        page.getByRole('heading', { name: 'Google sign-in could not complete' }),
      ).toBeVisible();
      await expectTemporaryCookiesCleared(context);
      expect(
        (await context.cookies(`${apiBaseURL}/auth/refresh`)).some(
          (cookie) => cookie.name === 'refreshToken',
        ),
      ).toBe(false);
    } finally {
      await revokeContextSession(context);
      await context.close();
    }
  }
});

test('unsafe return URLs are rejected before temporary cookies are stored', async ({
  browser,
}) => {
  const context = await browser.newContext();
  try {
    const response = await context.request.get(`${apiBaseURL}/auth/google`, {
      headers: { origin: frontendOrigin },
      params: { returnTo: 'https://attacker.example/capture' },
    });
    expect(response.status()).toBe(400);
    await expectTemporaryCookiesCleared(context);
  } finally {
    await revokeContextSession(context);
    await context.close();
  }
});

test('back navigation releases the OAuth reservation and allows retry', async ({
  page,
}) => {
  await beginGoogleSignIn(page);
  await page.goBack();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeEnabled();

  await page.getByRole('button', { name: 'Continue with Google' }).click();
  await page.getByRole('link', { name: 'Continue as Student' }).click();
  await expect(page).toHaveURL(/\/student\/dashboard$/);
  await logoutFromShell(page);
});
