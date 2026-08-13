/**
 * Location: frontend/e2e/real-backend-auth-storage-failure.spec.ts
 * Purpose: Verify browser storage denial cannot block a real memory-only login.
 * Why: Peers must converge through the server cookie without receiving token authority.
 */
import { expect, test } from '@playwright/test';

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

test('storage write denial preserves login and server-authoritative peer convergence', async ({
  browser,
}) => {
  const context = await browser.newContext();
  const pageA = await context.newPage();
  const pageB = await context.newPage();

  try {
    await Promise.all([pageA.goto('/login'), pageB.goto('/login')]);
    const peerBarrier = pageB.evaluate(
      () =>
        new Promise<void>((resolve) => {
          const channel = new BroadcastChannel('nce-auth-session');
          channel.addEventListener('message', (event) => {
            if (event.data?.e2eBarrier === true) {
              channel.close();
              resolve();
            }
          });
        }),
    );
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
    await pageA.evaluate(() => {
      const channel = new BroadcastChannel('nce-auth-session');
      channel.postMessage({ e2eBarrier: true });
      channel.close();
    });
    await peerBarrier;
    await expect
      .poll(() =>
        pageB.evaluate(async () => {
          const { authBridge } = await import('/src/lib/authBridge.ts');
          const snapshot = authBridge.getSnapshot();
          return snapshot.status === 'authenticated' ? snapshot.actor.role : 'anonymous';
        }),
      )
      .toBe('student');
    const peerRefresh = await pageB.request.post(`${apiBaseURL}/auth/refresh`, {
      data: {},
    });
    expect(peerRefresh.ok()).toBeTruthy();
    expect((await peerRefresh.json()).user.email).toBe(student.email);
  } finally {
    await context.request.post(`${apiBaseURL}/auth/logout`, { data: {} });
    await context.close();
  }
});
