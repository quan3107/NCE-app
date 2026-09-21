/**
 * Location: tests/studentOfficialGrades.component.test.tsx
 * Purpose: Exercise official result presentation and recovery controls.
 * Why: Missing scores and untrusted feedback must never imply a fabricated result.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { StudentGradesPage } from '../src/features/grades/components/StudentGradesPage';
import {
  renderFeedbackContent,
  rubricScoreLabel,
  scoreSummary,
} from '../src/features/grades/components/StudentGradePresentation';
import type { Grade } from '../src/types/domain/grades';

const state = vi.hoisted(() => ({
  error: null as Error | null,
  retryResources: vi.fn(),
  retryGrades: vi.fn(),
  navigate: vi.fn(),
}));
vi.mock('@store/authStore', () => ({
  useAuthStore: () => ({ currentUser: { id: 'student' } }),
}));
vi.mock('@lib/router', () => ({
  useRouter: () => ({ navigate: state.navigate }),
}));
vi.mock('@features/assignments/api', () => ({
  useAssignmentResources: () => ({
    submissions: [],
    assignments: [],
    isLoading: false,
    error: null,
    refetch: state.retryResources,
  }),
}));
vi.mock('@features/grades/api', () => ({
  useGradesQuery: () => ({
    data: [],
    isLoading: false,
    error: state.error,
    refetch: state.retryGrades,
  }),
}));
afterEach(() => {
  cleanup();
  state.error = null;
  vi.clearAllMocks();
});

test('empty results lead to assignments and failed results offer a real refetch', () => {
  const view = render(<StudentGradesPage />);
  fireEvent.click(screen.getByRole('button', { name: 'View Assignments' }));
  expect(state.navigate).toHaveBeenCalledWith('/student/assignments');
  state.error = new Error('Network unavailable');
  view.rerender(<StudentGradesPage />);
  expect(screen.getByText('Unable to load grades.')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(state.retryResources).toHaveBeenCalledOnce();
  expect(state.retryGrades).toHaveBeenCalledOnce();
});

test('feedback headings and bullets remain readable while HTML stays inert', () => {
  const view = render(
    <div>
      {renderFeedbackContent(
        '# Result\n## Next steps\n- Add evidence\n<script>alert(1)</script>',
      )}
    </div>,
  );
  expect(screen.getByRole('heading', { name: 'Result' })).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'Next steps' })).toBeTruthy();
  expect(screen.getByText('Add evidence')).toBeTruthy();
  expect(view.container.querySelector('script')).toBeNull();
  expect(screen.getByText('<script>alert(1)</script>')).toBeTruthy();
});

test('scores distinguish bands, percentages, unavailable and provisional results', () => {
  const grade = {
    scoreDisplay: { kind: 'points', value: 15, max: 20 },
  } as Grade;
  expect(scoreSummary(grade)).toMatchObject({
    primary: '15/20',
    secondary: '75%',
  });
  expect(
    scoreSummary({
      ...grade,
      scoreDisplay: { kind: 'ielts_band', value: 7.5, max: 9 },
    }),
  ).toMatchObject({ primary: '7.5', secondary: 'IELTS band' });
  expect(
    scoreSummary({
      ...grade,
      scoreDisplay: { kind: 'unavailable', label: 'Score unavailable' },
    }).primary,
  ).toBe('Score unavailable');
  expect(scoreSummary({ ...grade, provisionalOnly: true }).primary).toBe(
    'Provisional feedback',
  );
  expect(
    rubricScoreLabel({
      criteria: 'Evidence',
      points: 8,
      maxPoints: 0,
      scale: 'points',
    }),
  ).toBe('8 points');
});
