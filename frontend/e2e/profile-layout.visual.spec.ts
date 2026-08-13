/**
 * Location: frontend/e2e/profile-layout.visual.spec.ts
 * Purpose: Render and verify the authenticated desktop profile header.
 * Why: The card grid must place its title and action side by side in a real browser.
 */
import { expect, test } from '@playwright/test';

const admin = {
  id: 'admin-1',
  email: 'admin@example.com',
  fullName: 'Admin User',
  role: 'admin',
} as const;

test('profile title and edit action share the desktop header row', async ({
  page,
}) => {
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/auth/refresh')) {
      await route.fulfill({
        json: { user: admin, accessToken: 'admin-token-2' },
      });
      return;
    }
    if (path.endsWith('/me')) {
      await route.fulfill({
        json: {
          profile: { ...admin, status: 'active' },
          navigation: {
            items: [{
              id: 'profile',
              label: 'Profile',
              path: '/admin/profile',
              iconName: 'user',
              requiredPermission: 'profile:view',
              orderIndex: 7,
              badgeSource: null,
              children: [],
              isActive: true,
              featureFlag: null,
            }],
            permissions: ['profile:view'],
            featureFlags: {},
            version: 'visual-check',
          },
        },
      });
      return;
    }
    if (path.endsWith('/notifications')) {
      await route.fulfill({ json: [] });
      return;
    }
    if (path.endsWith('/submissions/pending-count')) {
      await route.fulfill({ json: { count: 0 } });
      return;
    }
    await route.fulfill({ status: 404, json: { message: 'Not found' } });
  });

  await page.goto('/admin/profile');
  const title = page.getByText('Personal Information');
  const editButton = page.getByRole('button', { name: 'Edit Profile' });
  await expect(title).toBeVisible();
  await expect(editButton).toBeVisible();
  const titleBox = await title.boundingBox();
  const buttonBox = await editButton.boundingBox();

  expect(titleBox).not.toBeNull();
  expect(buttonBox).not.toBeNull();
  expect(Math.abs((titleBox?.y ?? 0) - (buttonBox?.y ?? 0))).toBeLessThan(12);
  await page.screenshot({
    path: 'test-results/profile-header-layout.png',
    fullPage: true,
  });
});
