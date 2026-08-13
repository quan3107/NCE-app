/**
 * Location: frontend/e2e/real-backend-auth-ordering.spec.ts
 * Purpose: Verify multi-tab cookie and UI session ordering against the actual API.
 * Why: Mock servers cannot prove refresh rotation, logout clearing, or account intent.
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

function password(name: string): string {
  const configured = process.env[name] ?? process.env.PLAYWRIGHT_TEST_PASSWORD;
  if (configured) return configured;
  throw new Error(`${name} or PLAYWRIGHT_TEST_PASSWORD is required.`);
}

const student = {
  email: credential('PLAYWRIGHT_STUDENT_EMAIL', 'amelia.chan@ielts.local'),
  password: password('PLAYWRIGHT_STUDENT_PASSWORD'),
  landingPath: '/student/dashboard',
};
const teacher = {
  email: credential('PLAYWRIGHT_TEACHER_EMAIL', 'sarah.tutor@ielts.local'),
  password: password('PLAYWRIGHT_TEACHER_PASSWORD'),
  landingPath: '/teacher/dashboard',
};

test.beforeAll(async ({ request }) => {
  const response = await request.get(new URL('/health', apiURL.origin).toString());
  expect(response.ok()).toBeTruthy();
});

async function fillLogin(
  page: import('@playwright/test').Page,
  account: { email: string; password: string },
): Promise<void> {
  await page.getByLabel('Email').fill(account.email);
  await page.getByLabel('Password').fill(account.password);
}

async function openLogout(page: import('@playwright/test').Page): Promise<void> {
  await page
    .locator('header button')
    .filter({ has: page.locator('[data-slot="avatar"]') })
    .click();
  await page.getByRole('menuitem', { name: 'Logout' }).click();
}

async function expectMemoryRole(
  page: import('@playwright/test').Page,
  role: 'student' | 'teacher',
): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const { authBridge } = await import('/src/lib/authBridge.ts');
        const snapshot = authBridge.getSnapshot();
        return snapshot.status === 'authenticated' ? snapshot.actor.role : 'anonymous';
      }),
    )
    .toBe(role);
}

test('the login admitted last owns the real refresh cookie and both UIs', async ({
  browser,
}) => {
  const context = await browser.newContext();
  const pageA = await context.newPage();
  const pageB = await context.newPage();
  let releaseFirst = () => undefined;
  const firstGate = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });
  let markFirstReady = () => undefined;
  const firstReady = new Promise<void>((resolve) => {
    markFirstReady = resolve;
  });

  try {
    await Promise.all([pageA.goto('/login'), pageB.goto('/login')]);
    await Promise.all([fillLogin(pageA, student), fillLogin(pageB, teacher)]);
    await pageA.route(`${apiBaseURL}/auth/login`, async (route) => {
      const response = await route.fetch();
      markFirstReady();
      await firstGate;
      await route.fulfill({ response });
    });

    await pageA.getByRole('button', { name: 'Sign In' }).click();
    await firstReady;
    await pageB.getByRole('button', { name: 'Sign In' }).click();
    releaseFirst();

    await expect(pageB).toHaveURL(new RegExp(`${teacher.landingPath}$`));
    await expectMemoryRole(pageA, 'teacher');
    await expectMemoryRole(pageB, 'teacher');

    const refresh = await context.request.post(`${apiBaseURL}/auth/refresh`, {
      data: {},
    });
    expect(refresh.ok()).toBeTruthy();
    expect((await refresh.json()).user.email).toBe(teacher.email);
  } finally {
    releaseFirst();
    await context.request.post(`${apiBaseURL}/auth/logout`, { data: {} });
    await context.close();
  }
});

test('a cross-tab logout makes an in-flight real refresh stale', async ({
  browser,
}) => {
  const context = await browser.newContext();
  const pageA = await context.newPage();
  const pageB = await context.newPage();
  let releaseRefresh = () => undefined;
  const refreshGate = new Promise<void>((resolve) => {
    releaseRefresh = resolve;
  });
  let markRefreshReady = () => undefined;
  const refreshReady = new Promise<void>((resolve) => {
    markRefreshReady = resolve;
  });
  const invalidAccessToken = 'e2e-invalid-access-token';
  const protectedRequestMarker = 'cross-tab-stale-refresh';
  const protectedRequestURL = new URL(`${apiBaseURL}/me`);
  protectedRequestURL.searchParams.set('e2eCase', protectedRequestMarker);
  const realUnauthorizedStatuses: number[] = [];

  try {
    await Promise.all([pageA.goto('/login'), pageB.goto('/login')]);
    await fillLogin(pageA, student);
    await pageA.getByRole('button', { name: 'Sign In' }).click();
    await expect(pageA).toHaveURL(new RegExp(`${student.landingPath}$`));
    await expectMemoryRole(pageB, 'student');

    pageA.on('response', (response) => {
      const request = response.request();
      if (
        response.url() === protectedRequestURL.toString() &&
        request.headers().authorization === `Bearer ${invalidAccessToken}`
      ) {
        realUnauthorizedStatuses.push(response.status());
      }
    });
    await pageA.route(`${apiBaseURL}/auth/refresh`, async (route) => {
      const response = await route.fetch();
      markRefreshReady();
      await refreshGate;
      await route.fulfill({ response });
    });
    const protectedResult = pageA.evaluate(async ({ invalidBearer, requestMarker }) => {
      const { authBridge } = await import('/src/lib/authBridge.ts');
      const { apiClient } = await import('/src/lib/apiClient.ts');
      const admitted = authBridge.getSnapshot();
      if (admitted.status !== 'authenticated') {
        throw new Error('Expected an authenticated memory session.');
      }
      const signal = new AbortController().signal;
      authBridge.configure({
        admit: () => ({
          accessToken: invalidBearer,
          actorId: admitted.actor.id,
          revision: admitted.revision,
          signal,
        }),
        isCurrent: (candidate) => {
          const current = authBridge.getSnapshot();
          return (
            current.status === 'authenticated' &&
            current.actor.id === candidate.actorId &&
            current.revision === candidate.revision &&
            !candidate.signal.aborted
          );
        },
      });
      try {
        await apiClient('/me', {
          auth: 'required',
          params: { e2eCase: requestMarker },
        });
        return { status: -1, message: 'unexpected success' };
      } catch (error) {
        return {
          status: error instanceof Error && 'status' in error
            ? Number(error.status)
            : -1,
          message: error instanceof Error ? error.message : String(error),
        };
      }
    }, {
      invalidBearer: invalidAccessToken,
      requestMarker: protectedRequestMarker,
    });
    await refreshReady;

    const logoutResponse = pageB.waitForResponse(
      (response) => response.url() === `${apiBaseURL}/auth/logout`,
    );
    await openLogout(pageB);
    await expect
      .poll(() =>
        pageB.evaluate(async () => {
          const { authBridge } = await import('/src/lib/authBridge.ts');
          return authBridge.getSnapshot().status;
        }),
      )
      .toBe('anonymous');
    releaseRefresh();

    const result = await protectedResult;
    expect(result.status).toBe(0);
    expect(result.message).toMatch(/session changed/i);
    expect(realUnauthorizedStatuses).toEqual([401]);
    expect((await logoutResponse).status()).toBe(204);
    const postLogoutRefresh = await context.request.post(
      `${apiBaseURL}/auth/refresh`,
      { data: {} },
    );
    expect(postLogoutRefresh.status()).toBe(401);
  } finally {
    releaseRefresh();
    await context.request.post(`${apiBaseURL}/auth/logout`, { data: {} });
    await context.close();
  }
});

test('logout fences the other tab when both storage writes fail', async ({
  browser,
}) => {
  const context = await browser.newContext();
  const pageA = await context.newPage();
  const pageB = await context.newPage();

  try {
    await Promise.all([pageA.goto('/login'), pageB.goto('/login')]);
    await fillLogin(pageA, student);
    await pageA.getByRole('button', { name: 'Sign In' }).click();
    await expect(pageA).toHaveURL(new RegExp(`${student.landingPath}$`));
    await expectMemoryRole(pageB, 'student');

    await pageB.evaluate(() => {
      Storage.prototype.setItem = () => {
        throw new DOMException('Storage write denied', 'QuotaExceededError');
      };
    });
    const logoutResponse = pageB.waitForResponse(
      (response) => response.url() === `${apiBaseURL}/auth/logout`,
    );
    await openLogout(pageB);

    expect((await logoutResponse).status()).toBe(204);
    await expect
      .poll(() =>
        pageA.evaluate(async () => {
          const { authBridge } = await import('/src/lib/authBridge.ts');
          return authBridge.getSnapshot().status;
        }),
      )
      .toBe('anonymous');
    const profileStatus = await pageA.evaluate(async () => {
      const { apiClient } = await import('/src/lib/apiClient.ts');
      try {
        await apiClient('/me', { auth: 'required' });
        return 200;
      } catch (error) {
        return error instanceof Error && 'status' in error
          ? Number(error.status)
          : -1;
      }
    });
    expect(profileStatus).toBe(401);
  } finally {
    await context.request.post(`${apiBaseURL}/auth/logout`, { data: {} });
    await context.close();
  }
});
