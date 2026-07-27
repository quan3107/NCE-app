/**
 * Location: tests/public-navigation.component.test.tsx
 * Purpose: Define mobile public navigation and live footer-link behavior.
 * Why: Public pages must remain reachable by keyboard and narrow-screen users without dead ends.
 */
import assert from 'node:assert/strict';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, test, vi } from 'vitest';

import { AppShellPublic } from '../src/components/layout/AppShellPublic';

const router = vi.hoisted(() => ({ currentPath: '/', navigate: vi.fn() }));

vi.mock('@lib/router', () => ({
  useRouter: () => ({
    currentPath: router.currentPath,
    navigate: router.navigate,
  }),
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
  router.currentPath = '/';
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

const publicShell = () => <AppShellPublic><main>Public page</main></AppShellPublic>;

test('mobile menu exposes destinations and identifies the current page', async () => {
  router.currentPath = '/contact';
  render(publicShell());

  const trigger = screen.getByRole('button', { name: /open navigation/i });
  trigger.focus();
  fireEvent.click(trigger);

  const dialog = await screen.findByRole('dialog');
  for (const label of ['Home', 'Courses', 'About', 'Contact']) {
    assert.ok(within(dialog).getByRole('button', { name: new RegExp(label, 'i') }));
  }
  assert.equal(
    within(dialog).getByRole('button', { name: /contact/i }).getAttribute('aria-current'),
    'page',
  );

  fireEvent.click(within(dialog).getByRole('button', { name: /about/i }));
  assert.deepEqual(router.navigate.mock.calls.at(-1), ['/about']);
  assert.ok(screen.queryByRole('dialog') === null);
});

test.each(['/contact/', '/CONTACT'])(
  'desktop and mobile navigation identify the router alias %s',
  async (currentPath) => {
    router.currentPath = currentPath;
    render(publicShell());

    const navigation = screen.getByRole('navigation');
    assert.equal(
      within(navigation).getByRole('button', { name: /contact/i }).getAttribute('aria-current'),
      'page',
    );

    fireEvent.click(within(navigation).getByRole('button', { name: /open navigation/i }));
    const dialog = await screen.findByRole('dialog');
    assert.equal(
      within(dialog).getByRole('button', { name: /contact/i }).getAttribute('aria-current'),
      'page',
    );
  },
);

test('route changes invalidate an open mobile sheet', async () => {
  const view = render(publicShell());
  fireEvent.click(screen.getByRole('button', { name: /open navigation/i }));
  await screen.findByRole('dialog');

  router.currentPath = '/about';
  view.rerender(publicShell());

  await waitFor(() => assert.ok(screen.queryByRole('dialog') === null));
  assert.equal(
    screen.getByRole('button', { name: /open navigation/i }).getAttribute('aria-expanded'),
    'false',
  );
});

test('desktop breakpoint changes close a hidden mobile trigger and sheet', async () => {
  let breakpointListener: ((event: MediaQueryListEvent) => void) | undefined;
  const mediaQuery = {
    matches: false,
    media: '(min-width: 768px)',
    addEventListener: vi.fn((_type, listener) => {
      breakpointListener = listener as (event: MediaQueryListEvent) => void;
    }),
    removeEventListener: vi.fn(),
  };
  vi.stubGlobal('matchMedia', vi.fn(() => mediaQuery));

  render(publicShell());
  fireEvent.click(screen.getByRole('button', { name: /open navigation/i }));
  await screen.findByRole('dialog');

  mediaQuery.matches = true;
  act(() => breakpointListener?.({ matches: true } as MediaQueryListEvent));

  await waitFor(() => assert.ok(screen.queryByRole('dialog') === null));
  assert.equal(document.body.style.pointerEvents, '');
});

test('footer renders only destinations backed by live routes', () => {
  render(publicShell());

  assert.ok(screen.getByRole('contentinfo'));
  for (const unavailable of ['For Teachers', 'For Students', 'Privacy', 'Help Center', 'Documentation', 'Status']) {
    assert.ok(screen.queryByRole('button', { name: unavailable }) === null);
  }
});
