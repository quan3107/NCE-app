/**
 * Location: tests/badgeCounts.component.test.tsx
 * Purpose: Verify role-scoped badge count retry behavior.
 * Why: Prevents irrelevant role-forbidden count endpoints from surfacing shell errors.
 */
import assert from 'node:assert/strict';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, test, vi } from 'vitest';

import { useBadgeCounts } from '../src/features/navigation/hooks/useBadgeCounts';

const authState = vi.hoisted(() => ({
  role: 'student',
}));

const notificationsRefetch = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock('@store/authStore', () => ({
  useAuthStore: () => ({
    currentUser: {
      id: 'user-1',
      name: 'User One',
      email: 'user@example.com',
      role: authState.role,
    },
    isAuthenticated: true,
  }),
}));

vi.mock('@features/notifications/api', () => ({
  useUserNotifications: () => ({
    notifications: [],
    isLoading: false,
    error: null,
    refetch: notificationsRefetch,
  }),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  notificationsRefetch.mockClear();
  authState.role = 'student';
});

function BadgeSnapshot() {
  const { counts, error, refetch } = useBadgeCounts();

  return (
    <section>
      <output data-testid="assignments">{counts.assignments}</output>
      <output data-testid="submissions">{counts.submissions}</output>
      <output data-testid="error">{error?.message ?? ''}</output>
      <button type="button" onClick={() => void refetch()}>
        Retry badges
      </button>
    </section>
  );
}

function renderBadgeCounts() {
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
      <BadgeSnapshot />
    </QueryClientProvider>,
  );
}

test('student badge retry refetches assignments without calling submissions', async () => {
  const requestedPaths: string[] = [];

  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = new URL(String(input), 'http://localhost:4000');
    requestedPaths.push(url.pathname);

    if (url.pathname.endsWith('/assignments/pending-count')) {
      return new Response(JSON.stringify({ count: requestedPaths.length }), {
        headers: { 'content-type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ message: 'Forbidden' }), {
      status: 403,
      statusText: 'Forbidden',
      headers: { 'content-type': 'application/json' },
    });
  });

  renderBadgeCounts();

  await waitFor(() => {
    assert.equal(screen.getByTestId('assignments').textContent, '1');
  });

  fireEvent.click(screen.getByRole('button', { name: /retry badges/i }));

  await waitFor(() => {
    assert.equal(screen.getByTestId('assignments').textContent, '2');
  });

  assert.deepEqual(
    requestedPaths.filter((path) => path.endsWith('/submissions/pending-count')),
    [],
  );
  assert.equal(screen.getByTestId('error').textContent, '');
});
