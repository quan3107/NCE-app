/**
 * Location: tests/adminDashboard.component.test.tsx
 * Purpose: Verify admin dashboard refresh behavior.
 * Why: Ensures dashboard config failures can be retried from the visible refresh action.
 */
import assert from 'node:assert/strict';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, test, vi } from 'vitest';

import { AdminDashboardPage } from '../src/features/admin/components/AdminDashboardPage';

const metricsRefetch = vi.hoisted(() => vi.fn(async () => undefined));
const dashboardConfigRefetch = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock('@features/admin/api', () => ({
  useAdminDashboardMetrics: () => ({
    metrics: {
      users: 1,
      courses: 2,
      enrollments: 3,
      assignments: 4,
    },
    isLoading: false,
    error: null,
    refetch: metricsRefetch,
  }),
}));

vi.mock('@features/dashboard-config/useDashboardConfig', () => ({
  useDashboardConfig: () => ({
    config: null,
    source: 'unavailable',
    isLoading: false,
    error: new Error('Dashboard config unavailable'),
    refetch: dashboardConfigRefetch,
    saveConfig: vi.fn(),
    isSaving: false,
    resetConfig: vi.fn(),
    isResetting: false,
  }),
}));

afterEach(() => {
  cleanup();
  metricsRefetch.mockClear();
  dashboardConfigRefetch.mockClear();
});

test('admin dashboard refresh retries metrics and dashboard config', () => {
  render(
    <MemoryRouter>
      <AdminDashboardPage />
    </MemoryRouter>,
  );

  assert.ok(screen.getByText('Unable to load dashboard data.'));

  fireEvent.click(screen.getByRole('button', { name: /refresh/i }));

  assert.equal(metricsRefetch.mock.calls.length, 1);
  assert.equal(dashboardConfigRefetch.mock.calls.length, 1);
});
