/** Grade list transport stays bounded while preserving official score/feedback mapping. */
import React from 'react';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Assignment, Submission } from '@domain';
vi.mock('@lib/auth', () => ({ useAuth: () => ({ currentUser: { id: 'student', role: 'student' } }) }));
vi.mock('@lib/apiClient', () => ({ apiClient: vi.fn(), ApiError: class extends Error {} }));
const { apiClient } = await import('@lib/apiClient');
const { useGradesQuery } = await import('../src/features/grades/api');
afterEach(cleanup);
test('48 submissions use one batch and missing grades remain absent with IELTS band mapping intact', async () => {
  const submissions = Array.from({ length: 48 }, (_, i) => ({ id: `s${i}`, assignmentId: 'reading', studentId: 'student', status: 'graded', version: 1 })) as Submission[];
  const assignments = [{ id: 'reading', type: 'reading', maxScore: 9 }] as Assignment[];
  vi.mocked(apiClient).mockResolvedValue({ items: [{ id: 'grade', submissionId: 's0', finalScore: '6.5', band: '6.5', feedback: 'Teacher note', feedbackLabel: 'teacher feedback' }] });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const { result } = renderHook(() => useGradesQuery(submissions, assignments), { wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider> });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(apiClient).toHaveBeenCalledTimes(1);
  expect(apiClient).toHaveBeenCalledWith('/submissions/grades', expect.objectContaining({ method: 'POST', body: { submissionIds: submissions.map(row => row.id) } }));
  expect(result.current.data).toHaveLength(1);
  expect(result.current.data![0]).toMatchObject({ scoreDisplay: { kind: 'ielts_band', value: 6.5, max: 9 }, feedback: 'Teacher note' });
  client.clear();
});

test('large grade lists retain every result across batches of at most 100 IDs', async () => {
  vi.mocked(apiClient).mockReset();
  const submissions = Array.from({ length: 201 }, (_, index) => ({ id: `s${index}`, assignmentId: 'text', studentId: 'student', status: 'graded', version: 1 })) as Submission[];
  const assignments = [{ id: 'text', type: 'text', maxScore: 100 }] as Assignment[];
  vi.mocked(apiClient).mockImplementation(async (_path, options) => {
    const { submissionIds } = options!.body as { submissionIds: string[] };
    return { items: submissionIds.map(submissionId => ({ id: `grade-${submissionId}`, submissionId, finalScore: 75 })) } as never;
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const { result } = renderHook(() => useGradesQuery(submissions, assignments), { wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider> });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(apiClient).toHaveBeenCalledTimes(3);
  expect(vi.mocked(apiClient).mock.calls.map(([, options]) => (options!.body as { submissionIds: string[] }).submissionIds.length)).toEqual([100, 100, 1]);
  expect(result.current.data!.map(grade => grade.submissionId)).toEqual(submissions.map(row => row.id));
  client.clear();
});
