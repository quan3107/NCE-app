/**
 * Location: tests/public-navigation.component.test.tsx
 * Purpose: Define mobile public navigation and live footer-link behavior.
 * Why: Public pages must remain reachable by keyboard and narrow-screen users without dead ends.
 */
import assert from 'node:assert/strict';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, test, vi } from 'vitest';

import { AppShellPublic } from '../src/components/layout/AppShellPublic';

const router = vi.hoisted(() => ({ navigate: vi.fn() }));

vi.mock('@lib/router', () => ({
  useRouter: () => ({ currentPath: '/', navigate: router.navigate }),
}));

vi.mock('@store/authStore', () => ({
  useAuthStore: () => ({
    currentUser: { id: '', name: 'Guest', email: '', role: 'public' },
    isAuthenticated: false,
    logout: vi.fn(),
  }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

test('mobile menu exposes every public destination and closes after navigation', async () => {
  render(<AppShellPublic><main>Public page</main></AppShellPublic>);

  const trigger = screen.getByRole('button', { name: /open navigation/i });
  trigger.focus();
  fireEvent.click(trigger);

  const dialog = await screen.findByRole('dialog');
  for (const label of ['Home', 'Courses', 'About', 'Contact']) {
    assert.ok(within(dialog).getByRole('button', { name: new RegExp(label, 'i') }));
  }

  const contactButton = within(dialog).getByRole('button', { name: /contact/i });
  contactButton.focus();
  fireEvent.click(contactButton);

  assert.deepEqual(router.navigate.mock.calls.at(-1), ['/contact']);
  assert.ok(screen.queryByRole('dialog') === null);
});

test('footer renders only destinations backed by live routes', () => {
  render(<AppShellPublic><main>Public page</main></AppShellPublic>);

  assert.ok(screen.getByRole('contentinfo'));
  for (const unavailable of ['For Teachers', 'For Students', 'Privacy', 'Help Center', 'Documentation', 'Status']) {
    assert.ok(screen.queryByRole('button', { name: unavailable }) === null);
  }
});
