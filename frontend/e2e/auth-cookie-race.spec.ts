/**
 * Location: frontend/e2e/auth-cookie-race.spec.ts
 * Purpose: Verify stale refresh responses cannot replace a new account cookie.
 * Why: HttpOnly Set-Cookie races require a real browser and HTTP server.
 */

import { expect, test } from '@playwright/test';

const TEST_SERVER = 'http://127.0.0.1:4010';

test.beforeEach(async ({ request }) => {
  await request.post(`${TEST_SERVER}/test/reset`);
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
