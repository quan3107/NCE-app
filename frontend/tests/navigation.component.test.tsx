/**
 * Location: tests/navigation.component.test.tsx
 * Purpose: Exercise rendered navigation provider states.
 * Why: Protects authenticated navigation from exposing stale hardcoded feature links.
 */
import assert from 'node:assert/strict';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, test, vi } from 'vitest';

import { NavigationProvider, useNavigationContext } from '../src/features/navigation';

vi.mock('@store/authStore', () => ({
  useAuthStore: () => ({
    currentUser: {
      id: 'student-1',
      name: 'Student User',
      email: 'student@example.com',
      role: 'student',
    },
    isAuthenticated: true,
  }),
}));

vi.mock('@features/notifications/api', () => ({
  useUserNotifications: () => ({
    notifications: [],
    isLoading: false,
    error: null,
    refetch: async () => undefined,
  }),
}));

afterEach(() => {
  cleanup();
  window.localStorage?.clear();
  vi.restoreAllMocks();
});

function NavigationSnapshot() {
  const { items, source, error, refetch } = useNavigationContext();

  return (
    <section>
      <output data-testid="source">{source}</output>
      <output data-testid="error">{error?.message ?? ''}</output>
      <button type="button" onClick={() => void refetch()}>
        Refetch navigation
      </button>
      <ul>
        {items.map((item) => (
          <li key={item.id}>{item.path}</li>
        ))}
      </ul>
    </section>
  );
}

const liveNavigationPayload = {
  navigation: {
    items: [
      {
        id: 'student-dashboard',
        label: 'Dashboard',
        path: '/student/dashboard',
        iconName: 'layout-dashboard',
        requiredPermission: null,
        orderIndex: 0,
        badgeSource: null,
        children: [],
        isActive: true,
        featureFlag: null,
      },
    ],
    permissions: [],
    featureFlags: {},
    version: 'live-2026-06-26',
  },
};

function renderNavigation() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <NavigationProvider>
        <NavigationSnapshot />
      </NavigationProvider>
    </QueryClientProvider>,
  );
}

test('authenticated navigation failure does not expose hardcoded feature links', async () => {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
    new Response(JSON.stringify({ message: 'Navigation unavailable' }), {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'content-type': 'application/json' },
    }),
  );

  renderNavigation();

  await waitFor(
    () => {
      assert.equal(screen.getByTestId('source').textContent, 'unavailable');
      assert.match(screen.getByTestId('error').textContent ?? '', /Navigation unavailable/);
    },
    { timeout: 3_000 },
  );

  assert.ok(screen.queryByText('/student/nce') === null);
  assert.ok(screen.queryByText('/student/assignments') === null);
  assert.ok(screen.queryByText('/student/dashboard') === null);
});

test('authenticated navigation shows an unavailable state after a later refetch fails', async () => {
  let requestCount = 0;

  vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
    requestCount += 1;

    if (requestCount === 1) {
      return new Response(JSON.stringify(liveNavigationPayload), {
        headers: { 'content-type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ message: 'Navigation unavailable' }), {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'content-type': 'application/json' },
    });
  });

  renderNavigation();

  await waitFor(() => {
    assert.equal(screen.getByTestId('source').textContent, 'live');
    assert.ok(screen.getByText('/student/dashboard'));
  });

  fireEvent.click(screen.getByRole('button', { name: /refetch navigation/i }));

  await waitFor(
    () => {
      assert.equal(screen.getByTestId('error').textContent, 'Navigation unavailable');
      assert.equal(screen.getByTestId('source').textContent, 'unavailable');
    },
    { timeout: 3_000 },
  );

  assert.ok(screen.queryByText('/student/dashboard') === null);
});
