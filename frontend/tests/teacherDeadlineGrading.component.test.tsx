/** Teacher grading regressions: preserve earned scores and the reviewed version. */
import {
  cleanup,
  render,
  screen,
  fireEvent,
  waitFor,
} from '@testing-library/react';
import { afterEach, test, expect, vi } from 'vitest';
import { TeacherGradeFormPage } from '../src/features/assignments/components/TeacherGradeFormPage';
const state = vi.hoisted(() => ({
  existingGrade: null as null | {
    id: string;
    submissionId: string;
    rawScore: number;
    finalScore: number;
    adjustments: number;
    feedback: string;
  },
  save: vi.fn(),
  assignment: {
    id: 'a',
    courseId: 'c',
    title: 'Text',
    type: 'text',
    assignmentConfig: null,
  },
  submission: {
    id: 's',
    assignmentId: 'a',
    studentName: 'Student',
    status: 'late',
    version: 1,
  },
}));
vi.mock('@features/assignments/api', () => ({
  useAssignmentResources: () => ({
    assignments: [state.assignment],
    submissions: [state.submission],
  }),
  markSubmissionAsGraded: vi.fn(),
}));
vi.mock('@features/grades/api', () => ({
  useGradesQuery: () => ({
    data: state.existingGrade ? [state.existingGrade] : [],
    isLoading: false,
  }),
  useUpsertGradeMutation: () => ({ mutateAsync: state.save }),
}));
vi.mock('@features/ai-feedback/api', () => ({
  useApproveWritingFeedbackMutation: () => ({}),
  useFinalizeWritingFeedbackMutation: () => ({}),
}));
vi.mock('@features/rubrics/api', () => ({
  useCourseRubricsQuery: () => ({ data: [] }),
}));
vi.mock('@store/authStore', () => ({
  useAuthStore: () => ({ currentUser: { id: 'teacher', role: 'teacher' } }),
}));
vi.mock('@lib/router', () => ({ useRouter: () => ({ navigate: vi.fn() }) }));
vi.mock('../src/features/assignments/components/AiFeedbackReviewPanel', () => ({
  AiFeedbackReviewPanel: () => null,
}));
vi.mock('../src/features/assignments/components/TeacherGradePanels', () => ({
  TeacherGradePanels: (p: {
    onRawScoreChange: (value: number) => void;
    onPostGrade: () => void;
  }) => (
    <>
      <button onClick={() => p.onRawScoreChange(80)}>Score 80</button>
      <button onClick={p.onPostGrade}>Post grade</button>
    </>
  ),
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  state.existingGrade = null;
  state.submission = { ...state.submission, version: 1 };
});
test('late work retains its earned score when the teacher posts a grade', async () => {
  render(<TeacherGradeFormPage submissionId="s" />);
  fireEvent.click(screen.getByText('Score 80'));
  fireEvent.click(screen.getByText('Post grade'));
  await waitFor(() => expect(state.save).toHaveBeenCalled());
  expect(state.save.mock.calls[0][0].payload.finalScore).toBe(80);
});

test('a refetch cannot advance the version attached to existing feedback', async () => {
  const view = render(<TeacherGradeFormPage submissionId="s" />);
  fireEvent.click(screen.getByText('Score 80'));
  state.submission = { ...state.submission, version: 2 };
  view.rerender(<TeacherGradeFormPage submissionId="s" />);
  fireEvent.click(screen.getByText('Post grade'));
  await waitFor(() =>
    expect(state.save).toHaveBeenLastCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          expectedSubmissionVersion: 1,
          finalScore: 80,
        }),
      }),
    ),
  );
});

test('editing an existing grade preserves its historical adjustment without relabeling it', async () => {
  state.existingGrade = {
    id: 'grade',
    submissionId: 's',
    rawScore: 80,
    finalScore: 75,
    adjustments: -5,
    feedback: 'Historical feedback',
  };
  render(<TeacherGradeFormPage submissionId="s" />);
  fireEvent.click(screen.getByText('Post grade'));
  await waitFor(() => expect(state.save).toHaveBeenCalled());
  expect(state.save.mock.calls[0][0].payload).toMatchObject({
    rawScore: 80,
    finalScore: 75,
  });
  expect(state.save.mock.calls[0][0].payload.adjustments).toBeUndefined();
});
