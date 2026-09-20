/**
 * Location: tests/assignmentRouteStates.component.test.tsx
 * Purpose: Verify missing grading records and unavailable authoring prerequisites.
 * Why: Routes must explain unavailable data before presenting mutation controls.
 */
import assert from 'node:assert/strict';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, test, vi } from 'vitest';
import { TeacherGradeFormPage } from '../src/features/assignments/components/TeacherGradeFormPage';
import { TeacherIeltsAssignmentCreatePage } from '../src/features/assignments/components/TeacherIeltsAssignmentCreatePage';

const state = vi.hoisted(() => ({ courses: [] as Array<{ id: string; title: string }>,
  assignments: [], submissions: [], isLoading: false, error: null as Error | null,
  refetch: vi.fn(async () => undefined) }));
const navigate = vi.hoisted(() => vi.fn());
vi.mock('@features/assignments/api', () => ({
  useAssignmentResources: () => state,
  useCreateAssignmentMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
  markSubmissionAsGraded: vi.fn(),
}));
vi.mock('@lib/router', () => ({ useRouter: () => ({ navigate }) }));
// Editor internals are covered separately; these regressions target route gates.
vi.mock('../src/features/assignments/components/TeacherIeltsAssignmentEditor', () => ({ TeacherIeltsAssignmentEditor: () => null }));
vi.mock('../src/features/assignments/components/TeacherGradePanels', () => ({ TeacherGradePanels: () => null }));
vi.mock('../src/features/assignments/components/AiFeedbackReviewPanel', () => ({ AiFeedbackReviewPanel: () => null }));
vi.mock('@lib/auth', () => ({ useAuth: () => ({ currentUser: { id: 'teacher-1', role: 'teacher' } }) }));
vi.mock('@store/authStore', () => ({ useAuthStore: () => ({ currentUser: { id: 'teacher-1', role: 'teacher' } }) }));

afterEach(() => {
  cleanup(); state.error = null; state.isLoading = false; state.courses = [];
  navigate.mockClear(); state.refetch.mockClear(); window.localStorage.clear();
});
function wrap(child: React.ReactNode) {
  return <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{child}</QueryClientProvider>;
}

test('missing submission explains absence and returns to submissions', () => {
  render(wrap(<TeacherGradeFormPage submissionId="missing" />));
  assert.ok(screen.getByRole('heading', { name: 'Submission not found' }));
  assert.ok(screen.queryByRole('button', { name: /post grade/i }) === null);
  fireEvent.click(screen.getByRole('button', { name: 'Back to Submissions' }));
  assert.equal(navigate.mock.calls[0][0], '/teacher/submissions');
});

test('authoring gates failed and empty prerequisites before recovering the type chooser', () => {
  state.error = new Error('Read failed');
  const client = new QueryClient();
  const page = <QueryClientProvider client={client}><TeacherIeltsAssignmentCreatePage /></QueryClientProvider>;
  const view = render(page);
  assert.ok(screen.getByRole('alert'));
  assert.ok(screen.queryByRole('button', { name: /text response/i }) === null);
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  assert.equal(state.refetch.mock.calls.length, 1);
  state.error = null;
  view.rerender(<QueryClientProvider client={client}><TeacherIeltsAssignmentCreatePage /></QueryClientProvider>);
  assert.ok(screen.getByText(/No courses are available/));
  assert.ok(screen.queryByRole('button', { name: /create.*publish/i }) === null);
  state.courses = [{ id: 'course-1', title: 'Writing' }];
  view.rerender(<QueryClientProvider client={client}><TeacherIeltsAssignmentCreatePage /></QueryClientProvider>);
  assert.ok(screen.getByRole('button', { name: /text response/i }));
  client.clear();
});
