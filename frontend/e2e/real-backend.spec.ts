/**
 * Location: frontend/e2e/real-backend.spec.ts
 * Purpose: Verify dedicated users can authenticate through the actual API.
 * Why: The default E2E command must exercise and depend on a live backend.
 */

import { expect, test } from '@playwright/test';

type TestRole = 'admin' | 'teacher' | 'student';

type AuthResponse = {
  accessToken: string;
  user: {
    email: string;
    fullName: string;
    id: string;
    role: TestRole;
  };
};

const apiBaseURL = (
  process.env.PLAYWRIGHT_API_BASE_URL ?? 'http://127.0.0.1:4000/api/v1'
).replace(/\/$/, '');
const apiURL = new URL(apiBaseURL);
const usesLocalBackend = ['127.0.0.1', 'localhost', '::1'].includes(apiURL.hostname);

function testCredential(name: string, localDefault: string): string {
  const configured = process.env[name];
  if (configured) {
    return configured;
  }
  if (usesLocalBackend) {
    return localDefault;
  }
  throw new Error(`${name} is required when Playwright targets a non-local backend.`);
}

function testPassword(name: string): string {
  const configured = process.env[name] ?? process.env.PLAYWRIGHT_TEST_PASSWORD;
  if (configured) {
    return configured;
  }
  throw new Error(`${name} or PLAYWRIGHT_TEST_PASSWORD is required.`);
}

const accounts = [
  {
    role: 'admin',
    email: testCredential('PLAYWRIGHT_ADMIN_EMAIL', 'rosa.admin@ielts.local'),
    passwordEnvironment: 'PLAYWRIGHT_ADMIN_PASSWORD',
    landingPath: '/admin/dashboard',
  },
  {
    role: 'teacher',
    email: testCredential('PLAYWRIGHT_TEACHER_EMAIL', 'sarah.tutor@ielts.local'),
    passwordEnvironment: 'PLAYWRIGHT_TEACHER_PASSWORD',
    landingPath: '/teacher/dashboard',
  },
  {
    role: 'student',
    email: testCredential('PLAYWRIGHT_STUDENT_EMAIL', 'amelia.chan@ielts.local'),
    passwordEnvironment: 'PLAYWRIGHT_STUDENT_PASSWORD',
    landingPath: '/student/dashboard',
  },
] satisfies Array<{
  role: TestRole;
  email: string;
  passwordEnvironment: string;
  landingPath: string;
}>;

test.beforeAll(async ({ request }) => {
  const healthURL = new URL('/health', apiURL.origin);
  const response = await request.get(healthURL.toString(), { timeout: 5_000 });
  expect(response.ok(), `Backend health check failed at ${healthURL}`).toBeTruthy();
});

for (const account of accounts) {
  test(`${account.role} test account reaches its live session`, async ({ page }) => {
    let auth: AuthResponse | undefined;
    let loggedOut = false;

    try {
      const loginResponsePromise = page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          response.url() === `${apiBaseURL}/auth/login`,
      );

      await page.goto('/login');
      await page.getByLabel('Email').fill(account.email);
      await page.getByLabel('Password').fill(testPassword(account.passwordEnvironment));
      await page.getByRole('button', { name: 'Sign In' }).click();

      const loginResponse = await loginResponsePromise;
      expect(
        loginResponse.ok(),
        `Login returned ${loginResponse.status()} ${loginResponse.statusText()}`,
      ).toBeTruthy();
      auth = (await loginResponse.json()) as AuthResponse;
      expect(auth.user).toMatchObject({ email: account.email, role: account.role });
      await expect(page).toHaveURL(new RegExp(`${account.landingPath}$`));

      const restoredResponse = page.waitForResponse(
        (response) => response.url() === `${apiBaseURL}/auth/refresh`,
      );
      await page.reload();
      expect((await restoredResponse).ok()).toBeTruthy();
      await expect(page).toHaveURL(new RegExp(`${account.landingPath}$`));

      const profileResponse = await page.request.get(`${apiBaseURL}/me`);
      expect(profileResponse.status()).toBe(401);
      const cookieRefresh = await page.request.post(`${apiBaseURL}/auth/refresh`, {
        data: {},
      });
      expect(
        cookieRefresh.ok(),
        `Cookie refresh returned ${cookieRefresh.status()} ${cookieRefresh.statusText()}`,
      ).toBeTruthy();
      const refreshed = (await cookieRefresh.json()) as AuthResponse;
      expect(refreshed.user).toMatchObject({
        id: auth.user.id,
        email: account.email,
        role: account.role,
      });

      const rotatedRestore = page.waitForResponse(
        (response) => response.url() === `${apiBaseURL}/auth/refresh`,
      );
      await page.reload();
      expect((await rotatedRestore).ok()).toBeTruthy();
      await expect(page).toHaveURL(new RegExp(`${account.landingPath}$`));

      const logoutResponse = page.waitForResponse(
        (response) => response.url() === `${apiBaseURL}/auth/logout`,
      );
      await page
        .locator('header button')
        .filter({ has: page.locator('[data-slot="avatar"]') })
        .click();
      await page.getByRole('menuitem', { name: 'Logout' }).click();
      expect((await logoutResponse).status()).toBe(204);
      loggedOut = true;
      await expect(page).toHaveURL(/\/login$/);

      const postLogoutRefresh = await page.request.post(
        `${apiBaseURL}/auth/refresh`,
        { data: {} },
      );
      expect(postLogoutRefresh.status()).toBe(401);
    } finally {
      if (auth && !loggedOut) {
        await page.request.post(`${apiBaseURL}/auth/logout`, { data: {} });
      }
    }
  });
}
