/**
 * Location: tests/studentNotifications.component.test.tsx
 * Purpose: Verify student notification rendering when config services fail.
 * Why: Live notifications should remain readable even if type metadata is unavailable.
 */
import assert from 'node:assert/strict';
import { cleanup, render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, test, vi } from 'vitest';

import { StudentNotificationsPage } from '../src/features/notifications/components/StudentNotificationsPage';

vi.mock('@store/authStore', () => ({
  useAuthStore: () => ({
    currentUser: {
      id: 'student-1',
      name: 'Student One',
      email: 'student@example.com',
      role: 'student',
    },
  }),
}));

vi.mock('@features/notifications/api', () => ({
  markNotificationsRead: vi.fn(),
  useUserNotifications: () => ({
    notifications: [
      {
        id: 'notification-1',
        userId: 'student-1',
        type: 'assignment_due',
        title: 'Essay due tomorrow',
        message: 'Submit your IELTS essay before class.',
        timestamp: new Date('2026-06-26T12:00:00Z'),
        read: false,
      },
    ],
    isLoading: false,
    error: null,
  }),
}));

vi.mock('@features/notifications/config.api', () => ({
  getNotificationTypeLabel: (type: string) => type,
  useNotificationTypes: () => ({
    data: undefined,
    isLoading: false,
    error: new Error('Notification type config unavailable'),
  }),
}));

afterEach(() => {
  cleanup();
});

test('notification list renders when type config fails', () => {
  render(
    <MemoryRouter>
      <StudentNotificationsPage />
    </MemoryRouter>,
  );

  assert.ok(screen.getByText('Unable to load notification settings.'));
  assert.ok(screen.getByText('Essay due tomorrow'));
  assert.ok(screen.getByText('Submit your IELTS essay before class.'));
});
