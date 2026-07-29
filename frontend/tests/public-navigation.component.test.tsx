/**
 * Location: tests/public-navigation.component.test.tsx
 * Purpose: Define mobile public navigation and live footer-link behavior.
 * Why: Public pages must remain reachable by keyboard and narrow-screen users without dead ends.
 */
import assert from 'node:assert/strict';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, test, vi } from 'vitest';

import { AppShellPublic } from '../src/components/layout/AppShellPublic';

const router = vi.hoisted(() => ({
  currentEntryKey: 'home-entry',
  currentPath: '/',
  navigate: vi.fn(),
}));
const authState = vi.hoisted(() => ({
  currentUser: { id: '', name: 'Guest', email: '', role: 'public' as const },
  isAuthenticated: false,
}));

vi.mock('@lib/router', () => ({
  useRouter: () => ({
    currentEntryKey: router.currentEntryKey,
    currentPath: router.currentPath,
    navigate: router.navigate,
  }),
}));

vi.mock('@store/authStore', () => ({
  useAuthStore: () => ({
    currentUser: authState.currentUser,
    isAuthenticated: authState.isAuthenticated,
    logout: vi.fn(),
  }),
}));

afterEach(() => {
  cleanup();
  router.currentEntryKey = 'home-entry';
  router.currentPath = '/';
  authState.currentUser = { id: '', name: 'Guest', email: '', role: 'public' };
  authState.isAuthenticated = false;
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

const publicShell = () => <AppShellPublic><main>Public page</main></AppShellPublic>;
const renderPublicShell = () => render(publicShell(), { wrapper: MemoryRouter });

test('mobile menu exposes destinations and identifies the current page', async () => {
  router.currentPath = '/contact';
  renderPublicShell();

  const trigger = screen.getByRole('button', { name: /open navigation/i });
  trigger.focus();
  fireEvent.click(trigger);

  const dialog = await screen.findByRole('dialog');
  for (const label of ['Home', 'Courses', 'About', 'Contact']) {
    assert.ok(within(dialog).getByRole('link', { name: new RegExp(label, 'i') }));
  }
  assert.equal(
    within(dialog).getByRole('link', { name: /contact/i }).getAttribute('aria-current'),
    'page',
  );

  const aboutLink = within(dialog).getByRole('link', { name: /about/i });
  assert.equal(aboutLink.getAttribute('href'), '/about');
  fireEvent.click(aboutLink);
  assert.equal(router.navigate.mock.calls.length, 0);
  assert.ok(screen.queryByRole('dialog') === null);
});

test('closing the mobile sheet with Escape restores focus to its trigger', async () => {
  renderPublicShell();

  const trigger = screen.getByRole('button', { name: /open navigation/i });
  trigger.focus();
  fireEvent.click(trigger);
  const dialog = await screen.findByRole('dialog');

  fireEvent.keyDown(dialog, { key: 'Escape' });

  await waitFor(() => assert.ok(screen.queryByRole('dialog') === null));
  assert.equal(document.activeElement, trigger);
});

test.each(['/contact/', '/CONTACT'])(
  'desktop and mobile navigation identify the router alias %s',
  async (currentPath) => {
    router.currentPath = currentPath;
    renderPublicShell();

    const navigation = screen.getByRole('navigation');
    assert.equal(
      within(navigation).getByRole('button', { name: /contact/i }).getAttribute('aria-current'),
      'page',
    );

    fireEvent.click(within(navigation).getByRole('button', { name: /open navigation/i }));
    const dialog = await screen.findByRole('dialog');
    assert.equal(
      within(dialog).getByRole('link', { name: /contact/i }).getAttribute('aria-current'),
      'page',
    );
  },
);

test('route changes invalidate an open mobile sheet', async () => {
  const view = renderPublicShell();
  const trigger = screen.getByRole('button', { name: /open navigation/i });
  fireEvent.click(trigger);
  await screen.findByRole('dialog');

  router.currentEntryKey = 'about-entry';
  router.currentPath = '/about';
  view.rerender(publicShell());

  await waitFor(() => assert.ok(screen.queryByRole('dialog') === null));
  assert.equal(screen.getByRole('button', { name: /open navigation/i }), trigger);
  assert.equal(
    screen.getByRole('button', { name: /open navigation/i }).getAttribute('aria-expanded'),
    'false',
  );
});

test('same-path history entry changes invalidate an open mobile sheet', async () => {
  router.currentEntryKey = 'contact-entry-1';
  router.currentPath = '/contact';
  const view = renderPublicShell();
  fireEvent.click(screen.getByRole('button', { name: /open navigation/i }));
  await screen.findByRole('dialog');

  router.currentEntryKey = 'contact-entry-2';
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

  renderPublicShell();
  fireEvent.click(screen.getByRole('button', { name: /open navigation/i }));
  await screen.findByRole('dialog');

  mediaQuery.matches = true;
  act(() => breakpointListener?.({ matches: true } as MediaQueryListEvent));

  await waitFor(() => assert.ok(screen.queryByRole('dialog') === null));
  assert.equal(document.body.style.pointerEvents, '');
});

test('footer renders only destinations backed by live routes', () => {
  renderPublicShell();

  assert.ok(screen.getByRole('contentinfo'));
  for (const unavailable of ['For Teachers', 'For Students', 'Privacy', 'Help Center', 'Documentation', 'Status']) {
    assert.ok(screen.queryByRole('button', { name: unavailable }) === null);
  }
});

test('authenticated public shell renders complete Unicode initials', () => {
  authState.currentUser = {
    id: 'student-1',
    name: '😀A',
    email: 'student@example.com',
    role: 'student',
  };
  authState.isAuthenticated = true;

  renderPublicShell();

  assert.ok(screen.getByText('😀'));
});

test('modified mobile link clicks keep native link semantics', async () => {
  renderPublicShell();
  fireEvent.click(screen.getByRole('button', { name: /open navigation/i }));
  const dialog = await screen.findByRole('dialog');
  const coursesLink = within(dialog).getByRole('link', { name: /courses/i });
  const modifiedClick = new MouseEvent('click', {
    bubbles: true,
    cancelable: true,
    ctrlKey: true,
  });
  let defaultPreventedByLink = true;
  const stopTestNavigation = (event: MouseEvent) => {
    defaultPreventedByLink = event.defaultPrevented;
    event.preventDefault();
  };
  document.addEventListener('click', stopTestNavigation, { once: true });

  coursesLink.dispatchEvent(modifiedClick);

  assert.equal(defaultPreventedByLink, false);
  assert.equal(coursesLink.getAttribute('href'), '/courses');
  assert.equal(router.navigate.mock.calls.length, 0);
  await waitFor(() => assert.ok(screen.queryByRole('dialog') === null));
});
