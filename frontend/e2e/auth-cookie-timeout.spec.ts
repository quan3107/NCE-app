/**
 * Location: frontend/e2e/auth-cookie-timeout.spec.ts
 * Purpose: Verify timed-out cookie operations cannot overwrite later sessions.
 * Why: Abort fencing must cover late login and logout Set-Cookie responses.
 */
import { expect, test } from '@playwright/test';

const TEST_SERVER = 'http://127.0.0.1:4010';

test.beforeEach(async ({ request }) => {
  await request.post(`${TEST_SERVER}/test/reset`);
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
    let timedOut = false;
    try {
      await login('delayed-a@example.com');
    } catch (error) {
      timedOut = error instanceof Error && error.name === 'AbortError';
    }
    const responseB = await login('b@example.com');
    return { timedOut, loginBStatus: responseB.status };
  });

  expect(result).toEqual({ timedOut: true, loginBStatus: 200 });
  await request.post(`${TEST_SERVER}/test/release-login`);
  await page.waitForTimeout(100);
  const refreshedUser = await page.evaluate(async () => {
    const response = await fetch('http://127.0.0.1:4010/api/v1/auth/refresh', {
      method: 'POST',
      credentials: 'include',
    });
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
    await authRequest('login', { email: 'a@example.com', password: 'password' });
    let timedOut = false;
    try {
      await authRequest('logout?delay=true');
    } catch (error) {
      timedOut = error instanceof Error && error.name === 'AbortError';
    }
    const responseB = await authRequest('login', {
      email: 'b@example.com',
      password: 'password',
    });
    return { timedOut, loginBStatus: responseB.status };
  });

  expect(result).toEqual({ timedOut: true, loginBStatus: 200 });
  await request.post(`${TEST_SERVER}/test/release-logout`);
  await page.waitForTimeout(100);
  const refreshedUser = await page.evaluate(async () => {
    const response = await fetch('http://127.0.0.1:4010/api/v1/auth/refresh', {
      method: 'POST',
      credentials: 'include',
    });
    return (await response.json()) as { user: { id: string } };
  });
  expect(refreshedUser.user.id).toBe('user-b');
});
