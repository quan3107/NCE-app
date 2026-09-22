/**
 * Location: tests/assignmentActivity.component.test.tsx
 * Purpose: Exercise participation requests from the actual student routes.
 * Why: Cached list data must not prevent an assignment open reaching authorization.
 */
import assert from 'node:assert/strict';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, test, vi } from 'vitest';
import { StudentAssignmentDetailPage } from '../src/features/assignments/components/StudentAssignmentDetailPage';
import { StudentAssignmentsPage } from '../src/features/assignments/components/StudentAssignmentsPage';

const state = vi.hoisted(() => ({
  assignments: [
    {
      id: 'assignment-1',
      courseId: 'course-1',
      title: 'Read carefully',
      type: 'text',
      status: 'published',
      dueAt: null,
      description: '',
      maxScore: 100,
    },
  ],
  submissions: [],
  enrollments: [{ userId: 'student-1', courseId: 'course-1' }],
  courses: [{ id: 'course-1', title: 'English' }],
  isLoading: false,
  error: null as Error | null,
}));
const request = vi.hoisted(() => vi.fn(async () => ({})));
vi.mock('@lib/apiClient', () => ({ apiClient: request }));
vi.mock('@features/assignments/api', () => ({
  useAssignmentResources: () => state,
  useCreateSubmissionMutation: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock('@lib/router', () => ({ useRouter: () => ({ navigate: vi.fn() }) }));
vi.mock('@store/authStore', () => ({
  useAuthStore: () => ({
    currentUser: { id: 'student-1', role: 'student' },
    sessionGeneration: 1,
  }),
}));
// These children have independent network/editor behavior outside route-open tracking.
vi.mock('../src/features/courses/CourseReminderToggle', () => ({
  CourseReminderToggle: () => null,
}));
vi.mock(
  '../src/features/assignments/components/StudentAssignmentSubmitDialog',
  () => ({ StudentAssignmentSubmitDialog: () => null }),
);

afterEach(() => {
  cleanup();
  request.mockClear();
  state.isLoading = false;
  state.error = null;
});

test('list browsing is excluded; detail opens and cached return navigation reach the server', async () => {
  const list = render(<StudentAssignmentsPage />);
  assert.equal(request.mock.calls.length, 0);
  list.unmount();
  const detail = render(
    <StudentAssignmentDetailPage assignmentId="assignment-1" />,
  );
  await waitFor(() => assert.equal(request.mock.calls.length, 1));
  assert.deepEqual(request.mock.calls[0], [
    '/api/v1/courses/course-1/assignments/assignment-1',
    { auth: 'required' },
  ]);
  detail.rerender(<StudentAssignmentDetailPage assignmentId="assignment-1" />);
  assert.equal(request.mock.calls.length, 1);
  detail.unmount();
  render(<StudentAssignmentDetailPage assignmentId="assignment-1" />);
  await waitFor(() => assert.equal(request.mock.calls.length, 2));
});

test('loading, failed and missing detail data do not record an open; loaded recovery does', async () => {
  state.isLoading = true;
  const view = render(
    <StudentAssignmentDetailPage assignmentId="assignment-1" />,
  );
  assert.equal(request.mock.calls.length, 0);
  state.isLoading = false;
  state.error = new Error('Unavailable');
  view.rerender(<StudentAssignmentDetailPage assignmentId="assignment-1" />);
  assert.equal(request.mock.calls.length, 0);
  state.error = null;
  view.rerender(<StudentAssignmentDetailPage assignmentId="missing" />);
  assert.ok(screen.getByText('Assignment not found'));
  assert.equal(request.mock.calls.length, 0);
  request.mockRejectedValueOnce(new Error('Access revoked'));
  view.rerender(<StudentAssignmentDetailPage assignmentId="assignment-1" />);
  await waitFor(() => assert.equal(request.mock.calls.length, 1));
  assert.ok(screen.getByRole('heading', { name: 'Read carefully' }));
});
