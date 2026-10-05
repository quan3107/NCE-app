/** Staff pagination resets resource cursors without silently skipping newly opened assignments. */
import React from 'react';
import { act, renderHook, waitFor, cleanup } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
vi.mock('@lib/auth', () => ({ useAuth: () => ({ currentUser: { id: 'teacher', role: 'teacher' } }) }));
vi.mock('@lib/apiClient', () => ({ apiClient: vi.fn() }));
const { apiClient } = await import('@lib/apiClient');
const { useStaffPage } = await import('../src/features/assignments/staff-api');
afterEach(cleanup);
test('Next/Previous fetch only the requested page and a new assignment starts at page one', async () => {
  vi.mocked(apiClient).mockResolvedValue({ items: [{ id: 'visible' }], nextCursor: 'next', total: 100 });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const { result, rerender } = renderHook(({ assignmentId }) => useStaffPage('/submissions/summaries', 'staff', { assignmentId, pending: 'false' }), {
    initialProps: { assignmentId: 'one' }, wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
  });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(apiClient).toHaveBeenCalledTimes(1);
  act(() => result.current.next());
  await waitFor(() => expect(apiClient).toHaveBeenCalledTimes(2));
  expect(result.current.page).toBe(2);
  expect(apiClient).toHaveBeenLastCalledWith('/submissions/summaries', expect.objectContaining({ params: { assignmentId: 'one', pending: 'false', cursor: 'next', limit: 50 } }));
  act(() => result.current.previous());
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.page).toBe(1);
  expect(result.current.canPrevious).toBe(false);
  expect(result.current.data?.total).toBe(100);
  act(() => result.current.next());
  rerender({ assignmentId: 'two' });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.page).toBe(1);
  expect(apiClient).toHaveBeenLastCalledWith('/submissions/summaries', expect.objectContaining({ params: { assignmentId: 'two', pending: 'false', cursor: undefined, limit: 50 } }));
  client.clear();
});
