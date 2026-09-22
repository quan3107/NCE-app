/** Reminder interaction regressions supplement real Browser/API preference verification. */
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { CourseReminderToggle } from '../src/features/courses/CourseReminderToggle';
import { StudentAssignmentHeaderActions } from '../src/features/assignments/components/StudentAssignmentHeaderActions';

const api = vi.hoisted(() => vi.fn());
vi.mock('@lib/apiClient', () => ({ apiClient: api }));
vi.mock('@store/authStore', () => ({ useAuthStore: () => ({ currentUser: { id: 'student' }, sessionGeneration: 1 }) }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });

test('course mute retains the original state after an error and persists a successful retry', async () => {
  api.mockResolvedValueOnce({ muted: false }).mockRejectedValueOnce(new Error('Save failed')).mockResolvedValueOnce({ muted: true });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><CourseReminderToggle courseId="course" /></QueryClientProvider>);
  fireEvent.click(await screen.findByRole('button', { name: 'Mute course reminders' }));
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Save failed');
  fireEvent.click(screen.getByRole('button', { name: 'Mute course reminders' }));
  await screen.findByRole('button', { name: 'Unmute course reminders' });
  expect(api).toHaveBeenLastCalledWith('/api/v1/courses/course/reminders', { auth: 'required', method: 'PUT', body: { muted: true } });
  client.clear();
});

test('pending preference save disables duplicate clicks', async () => {
  let resolve!: (value: { muted: boolean }) => void;
  api.mockResolvedValueOnce({ muted: false }).mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  const client = new QueryClient();
  render(<QueryClientProvider client={client}><CourseReminderToggle courseId="course" /></QueryClientProvider>);
  fireEvent.click(await screen.findByRole('button', { name: 'Mute course reminders' }));
  await waitFor(() => expect((screen.getByRole('button', { name: 'Saving reminders…' }) as HTMLButtonElement).disabled).toBe(true));
  resolve({ muted: true });
  await screen.findByRole('button', { name: 'Unmute course reminders' });
  client.clear();
});

test('late submission stays enabled until the cutoff; closure disables submission', () => {
  const props = { submission: null, isOverdue: true, canResubmit: false, hasReachedMaxAttempts: false, onOpenSubmit: vi.fn() };
  const view = render(<StudentAssignmentHeaderActions {...props} />);
  expect((screen.getByRole('button', { name: 'Submit Assignment' }) as HTMLButtonElement).disabled).toBe(false);
  view.rerender(<StudentAssignmentHeaderActions {...props} isClosed />);
  expect((screen.getByRole('button', { name: 'Submissions closed' }) as HTMLButtonElement).disabled).toBe(true);
});
