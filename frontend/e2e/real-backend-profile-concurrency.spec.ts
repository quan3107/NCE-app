/**
 * Location: frontend/e2e/real-backend-profile-concurrency.spec.ts
 * Purpose: Verify stale profile drafts conflict against the real database.
 * Why: Cache invalidation must never let one tab adopt another tab's revision.
 */
import { expect, test, type Page } from '@playwright/test';

type Profile = {
  id: string;
  fullName: string;
  profileRevision: number;
};

const apiBaseURL = 'http://127.0.0.1:4000/api/v1';
const password = process.env.PLAYWRIGHT_TEST_PASSWORD ?? '';

async function readProfile(page: Page): Promise<Profile> {
  return page.evaluate(async () => {
    const { apiClient } = await import('/src/lib/apiClient.ts');
    const response = await apiClient<{ profile: Profile }>('/me', {
      auth: 'required',
    });
    return response.profile;
  });
}

async function restoreProfile(page: Page, original: Profile): Promise<void> {
  const current = await readProfile(page);
  if (current.fullName === original.fullName) return;
  await page.evaluate(
    async ({ fullName, expectedRevision }) => {
      const { apiClient } = await import('/src/lib/apiClient.ts');
      await apiClient('/me', {
        auth: 'required',
        method: 'PATCH',
        body: { fullName, expectedRevision },
      });
    },
    { fullName: original.fullName, expectedRevision: current.profileRevision },
  );
}

async function openEditor(page: Page): Promise<void> {
  await page.goto('/student/profile');
  await expect(page.getByRole('button', { name: 'Edit Profile' })).toBeEnabled();
  await page.getByRole('button', { name: 'Edit Profile' }).click();
}

async function loginWithPassword(page: Page, email: string, userPassword: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(userPassword);
  await page.getByRole('button', { name: 'Sign In' }).click();
}

async function removeDisposableUser(email: string): Promise<void> {
  const { basePrisma, shutdownPrisma } = await import(
    '../../backend/src/prisma/client.ts'
  );
  try {
    const user = await basePrisma.user.findUnique({ where: { email } });
    if (!user) return;
    await basePrisma.$transaction(async (tx) => {
      await tx.auditLog.updateMany({
        where: { actorId: user.id },
        data: { actorId: null },
      });
      await tx.authSession.deleteMany({ where: { userId: user.id } });
      await tx.identity.deleteMany({ where: { userId: user.id } });
      await tx.user.delete({ where: { id: user.id } });
    });
  } finally {
    await shutdownPrisma();
  }
}

test('a stale tab preserves its draft and must reload before retrying', async ({
  browser,
}) => {
  expect(password, 'PLAYWRIGHT_TEST_PASSWORD is required.').not.toBe('');
  const context = await browser.newContext();
  const pageA = await context.newPage();
  const pageB = await context.newPage();
  let original: Profile | undefined;

  try {
    await pageA.goto('/login');
    await pageA.getByLabel('Email').fill('amelia.chan@ielts.local');
    await pageA.getByLabel('Password').fill(password);
    await pageA.getByRole('button', { name: 'Sign In' }).click();
    await expect(pageA).toHaveURL(/\/student\/dashboard$/);
    original = await readProfile(pageA);

    await Promise.all([openEditor(pageA), openEditor(pageB)]);
    const suffix = Date.now().toString(36);
    const winner = `Peer Winner ${suffix}`;
    const staleDraft = `Dirty Draft ${suffix}`;
    await pageA.getByLabel('Name').fill(winner);
    await pageB.getByLabel('Name').fill(staleDraft);

    const winningPatch = pageA.waitForResponse(
      (response) =>
        response.url() === `${apiBaseURL}/me` &&
        response.request().method() === 'PATCH',
    );
    await pageA.getByRole('button', { name: 'Save Changes' }).click();
    expect((await winningPatch).status()).toBe(200);
    await expect(pageA.getByRole('button', { name: 'Edit Profile' })).toBeVisible();
    await expect(pageB.getByLabel('Name')).toHaveValue(staleDraft);

    const stalePatch = pageB.waitForResponse(
      (response) =>
        response.url() === `${apiBaseURL}/me` &&
        response.request().method() === 'PATCH',
    );
    await pageB.getByRole('button', { name: 'Save Changes' }).click();
    expect((await stalePatch).status()).toBe(409);
    await expect(pageB.getByRole('alert')).toContainText('changed elsewhere');
    await expect(pageB.getByLabel('Name')).toHaveValue(staleDraft);
    await expect(readProfile(pageA)).resolves.toMatchObject({ fullName: winner });

    await pageB.getByRole('button', { name: 'Reload latest profile' }).click();
    await expect(pageB.getByLabel('Name')).toHaveValue(winner);
    await expect(pageB.getByRole('button', { name: 'Reload latest profile' })).toHaveCount(0);

    const retryName = `Reviewed Draft ${suffix}`;
    await pageB.getByLabel('Name').fill(retryName);
    const retryPatch = pageB.waitForResponse(
      (response) =>
        response.url() === `${apiBaseURL}/me` &&
        response.request().method() === 'PATCH',
    );
    await pageB.getByRole('button', { name: 'Save Changes' }).click();
    expect((await retryPatch).status()).toBe(200);
    await expect(readProfile(pageB)).resolves.toMatchObject({ fullName: retryName });

    await openEditor(pageB);
    const transientDraft = `Transient Draft ${suffix}`;
    await pageB.getByLabel('Name').fill(transientDraft);
    await pageB.route(
      `${apiBaseURL}/me`,
      (route) => route.abort('failed'),
      { times: 1 },
    );
    await pageB.getByRole('button', { name: 'Save Changes' }).click();
    await expect(pageB.getByRole('alert')).toContainText('Unable to save');
    await expect(pageB.getByLabel('Name')).toHaveValue(transientDraft);
    const transientRetry = pageB.waitForResponse(
      (response) =>
        response.url() === `${apiBaseURL}/me` &&
        response.request().method() === 'PATCH',
    );
    await pageB.getByRole('button', { name: 'Save Changes' }).click();
    expect((await transientRetry).status()).toBe(200);

    await openEditor(pageB);
    await pageB.getByLabel('Name').fill('A\u200ELovelace');
    await pageB.getByRole('button', { name: 'Save Changes' }).click();
    await expect(pageB.getByText(/non-printing or bidirectional controls/i)).toBeVisible();
    await pageB.getByLabel('Name').fill('😀'.repeat(100));
    const unicodePatch = pageB.waitForResponse(
      (response) =>
        response.url() === `${apiBaseURL}/me` &&
        response.request().method() === 'PATCH',
    );
    await pageB.getByRole('button', { name: 'Save Changes' }).click();
    expect((await unicodePatch).status()).toBe(200);
    await expect(readProfile(pageB)).resolves.toMatchObject({
      fullName: '😀'.repeat(100),
    });
  } finally {
    if (original) await restoreProfile(pageA, original);
    await context.request.post(`${apiBaseURL}/auth/logout`, { data: {} });
    await context.close();
  }
});

test('admin suspension and deletion end an active profile editing session', async ({
  browser,
}) => {
  test.slow();
  expect(password, 'PLAYWRIGHT_TEST_PASSWORD is required.').not.toBe('');
  const suffix = Date.now().toString(36);
  const email = `auth-terminal-${suffix}@example.test`;
  const originalName = `Terminal User ${suffix}`;
  const userContext = await browser.newContext();
  const adminContext = await browser.newContext();
  const userPage = await userContext.newPage();
  const adminPage = await adminContext.newPage();

  try {
    await userPage.goto('/register');
    await userPage.getByLabel('Full Name').fill(originalName);
    await userPage.getByLabel('Email').fill(email);
    await userPage.getByRole('combobox', { name: 'I am a...' }).click();
    await userPage.getByRole('option', { name: 'Student' }).click();
    await userPage.getByLabel('Password', { exact: true }).fill(password);
    await userPage.getByLabel('Confirm Password').fill(password);
    await userPage.getByRole('checkbox', { name: /terms and conditions/i }).check();
    await userPage.getByRole('button', { name: 'Create Account' }).click();
    await expect(userPage).toHaveURL(/\/student\/(dashboard|profile)$/);

    await openEditor(userPage);
    await userPage.getByLabel('Name').fill(`Suspended Draft ${suffix}`);

    await loginWithPassword(adminPage, 'rosa.admin@ielts.local', password);
    await expect(adminPage).toHaveURL(/\/admin\/dashboard$/);
    await adminPage.goto('/admin/users');
    await adminPage.getByPlaceholder('Search users...').fill(email);
    const userRow = adminPage.getByRole('row').filter({ hasText: email });
    await expect(userRow).toBeVisible();
    await userRow.getByRole('button', { name: 'Suspend' }).click();
    await expect(userRow).toContainText('Suspended');

    const suspendedPatch = userPage.waitForResponse(
      (response) =>
        response.url() === `${apiBaseURL}/me` &&
        response.request().method() === 'PATCH',
    );
    await userPage.getByRole('button', { name: 'Save Changes' }).click();
    expect([401, 403]).toContain((await suspendedPatch).status());
    await expect(userPage).toHaveURL(/\/login$/);

    await userRow.getByRole('button', { name: 'Reactivate' }).click();
    await expect(userRow).toContainText('Active');
    await loginWithPassword(userPage, email, password);
    await expect(userPage).toHaveURL(/\/student\/(dashboard|profile)$/);
    await openEditor(userPage);
    await userPage.getByLabel('Name').fill(`Deleted Draft ${suffix}`);

    adminPage.once('dialog', (dialog) => dialog.accept());
    await userRow.getByRole('button', { name: 'Delete' }).click();
    await expect(userRow).toHaveCount(0);

    const deletedPatch = userPage.waitForResponse(
      (response) =>
        response.url() === `${apiBaseURL}/me` &&
        response.request().method() === 'PATCH',
    );
    await userPage.getByRole('button', { name: 'Save Changes' }).click();
    const deletedStatus = (await deletedPatch).status();
    expect(deletedStatus).toBeGreaterThanOrEqual(401);
    expect(deletedStatus).toBeLessThan(500);
    await expect(userPage).toHaveURL(/\/login$/);
    await loginWithPassword(userPage, email, password);
    await expect(userPage).toHaveURL(/\/login$/);
    await expect(userPage.getByText('Invalid email or password')).toBeVisible();
  } finally {
    await Promise.all([
      userContext.request.post(`${apiBaseURL}/auth/logout`, { data: {} }),
      adminContext.request.post(`${apiBaseURL}/auth/logout`, { data: {} }),
    ]);
    await Promise.all([userContext.close(), adminContext.close()]);
    await removeDisposableUser(email);
  }
});
