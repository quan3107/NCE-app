/**
 * Location: tests/navigation.component.test.tsx
 * Purpose: Exercise rendered navigation provider states.
 * Why: Protects authenticated navigation from exposing stale hardcoded feature links.
 */
import assert from 'node:assert/strict';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
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
  localStorage.clear();
  vi.restoreAllMocks();
});

function NavigationSnapshot() {
  const { items, source, error } = useNavigationContext();

  return (
    <section>
      <output data-testid="source">{source}</output>
      <output data-testid="error">{error?.message ?? ''}</output>
      <ul>
        {items.map((item) => (
          <li key={item.id}>{item.path}</li>
        ))}
      </ul>
    </section>
  );
}

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

  assert.equal(screen.queryByText('/student/nce'), null);
  assert.equal(screen.queryByText('/student/assignments'), null);
  assert.equal(screen.queryByText('/student/dashboard'), null);
});
