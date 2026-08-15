/**
 * Location: frontend/e2e/real-backend-auth-storage-failure.spec.ts
 * Purpose: Verify browser storage denial cannot block a real memory-only login.
 * Why: Peers must converge through the server cookie without receiving token authority.
 */
import { expect, test, type Page } from '@playwright/test';

const apiBaseURL = (
  process.env.PLAYWRIGHT_API_BASE_URL ?? 'http://127.0.0.1:4000/api/v1'
).replace(/\/$/, '');
const apiURL = new URL(apiBaseURL);
const usesLocalBackend = ['127.0.0.1', 'localhost', '::1'].includes(apiURL.hostname);

function credential(name: string, localDefault: string): string {
  const configured = process.env[name];
  if (configured) return configured;
  if (usesLocalBackend) return localDefault;
  throw new Error(`${name} is required when targeting a non-local backend.`);
}

const student = {
  email: credential('PLAYWRIGHT_STUDENT_EMAIL', 'amelia.chan@ielts.local'),
  password:
    process.env.PLAYWRIGHT_STUDENT_PASSWORD ??
    process.env.PLAYWRIGHT_TEST_PASSWORD ??
    '',
};

test.beforeAll(async ({ request }) => {
  expect(student.password, 'A seeded student password is required.').not.toBe('');
  const response = await request.get(new URL('/health', apiURL.origin).toString());
  expect(response.ok()).toBeTruthy();
});

async function waitForAuthRuntime(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const { authBridge } = await import('/src/lib/authBridge.ts');
    await authBridge.waitUntilReady();
  });
}

test('storage write denial preserves login and server-authoritative peer convergence', async ({
  browser,
}) => {
  const context = await browser.newContext();
  const pageA = await context.newPage();
  const pageB = await context.newPage();

  try {
    await Promise.all([pageA.goto('/login'), pageB.goto('/login')]);
    // Storage denial removes the persisted catch-up path, so both application
    // subscribers must be ready before the transient invalidation is published.
    await Promise.all([waitForAuthRuntime(pageA), waitForAuthRuntime(pageB)]);
    await pageA.evaluate(() => {
      Storage.prototype.setItem = () => {
        throw new DOMException('Storage write denied', 'QuotaExceededError');
      };
    });
    await pageA.getByLabel('Email').fill(student.email);
    await pageA.getByLabel('Password').fill(student.password);
    const loginResponse = pageA.waitForResponse(
      (response) => response.url() === `${apiBaseURL}/auth/login`,
    );
    await pageA.getByRole('button', { name: 'Sign In' }).click();

    expect((await loginResponse).status()).toBe(200);
    await expect(pageA).toHaveURL(/\/student\/dashboard$/);
    await expect
      .poll(() =>
        pageA.evaluate(async () => {
          const { authBridge } = await import('/src/lib/authBridge.ts');
          const snapshot = authBridge.getSnapshot();
          return snapshot.status === 'authenticated' ? snapshot.actor.role : 'anonymous';
        }),
      )
      .toBe('student');
    await expect
      .poll(() =>
        pageB.evaluate(async () => {
          const { authBridge } = await import('/src/lib/authBridge.ts');
          const snapshot = authBridge.getSnapshot();
          return snapshot.status === 'authenticated' ? snapshot.actor.role : 'anonymous';
        }),
      )
      .toBe('student');
    const peerVerification = await pageB.evaluate(async () => {
      const { authBridge } = await import('/src/lib/authBridge.ts');
      const { apiClient } = await import('/src/lib/apiClient.ts');
      const refresh = await authBridge.refreshAccessToken();
      const profile = await apiClient<{ profile: { email: string } }>('/me', {
        auth: 'required',
      });
      return { refreshStatus: refresh.status, email: profile.profile.email };
    });
    expect(peerVerification).toEqual({
      refreshStatus: 'refreshed',
      email: student.email,
    });
  } finally {
    await context.request.post(`${apiBaseURL}/auth/logout`, { data: {} });
    await context.close();
  }
});
