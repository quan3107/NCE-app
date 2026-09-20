/**
 * Location: tests/rubrics.component.test.tsx
 * Purpose: Verify rubric create UI respects backend schema constraints.
 * Why: Prevents submitting server-invalid rubric criteria from incomplete templates.
 */
import assert from 'node:assert/strict';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, test, vi } from 'vitest';

import { TeacherRubricsPage } from '../src/features/rubrics/components/TeacherRubricsPage';
vi.mock('@lib/router', () => ({ useRouter: () => ({ navigate: vi.fn() }) }));

const createRubric = vi.hoisted(() => vi.fn(async () => undefined));
const courseState = vi.hoisted(() => ({
  data: [{ id: 'course-1', title: 'Writing Course' }],
  isLoading: false, error: null as Error | null, isFetching: false, refetch: vi.fn(),
}));

vi.mock('@features/courses/api', () => ({
  useCoursesQuery: () => courseState,
}));

vi.mock('@features/rubrics/api', () => ({
  useCourseRubricsQuery: () => ({
    data: [],
    isLoading: false,
    error: null,
  }),
  useCreateRubricMutation: () => ({
    mutateAsync: createRubric,
    isPending: false,
  }),
  useDefaultRubricsQuery: () => ({
    data: {
      templates: [
        {
          id: 'template-1',
          name: 'Incomplete Writing Template',
          context: 'assignment',
          assignmentType: 'writing',
          source: 'backend',
          criteria: [
            {
              id: 'criterion-1',
              name: 'Task Response',
              weight: 100,
            },
          ],
        },
      ],
    },
    isFetching: false,
    error: null,
  }),
}));

vi.mock('sonner@2.0.3', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

afterEach(() => {
  cleanup();
  createRubric.mockClear();
  courseState.error = null;
  courseState.isLoading = false;
  courseState.refetch.mockClear();
});

test('failed course lookup is not an empty rubric list and offers recovery', () => {
  courseState.error = new Error('Read failed');
  const view = render(<TeacherRubricsPage />);
  assert.ok(screen.getByText('Unable to load courses.'));
  assert.ok(screen.queryByText('No rubrics yet for this course.') === null);
  assert.equal((screen.getByRole('button', { name: 'Create Rubric' }) as HTMLButtonElement).disabled, true);
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  assert.equal(courseState.refetch.mock.calls.length, 1);
  courseState.error = null;
  view.rerender(<TeacherRubricsPage />);
  assert.ok(screen.getByText('No rubrics yet for this course.'));
  assert.equal((screen.getByRole('button', { name: 'Create Rubric' }) as HTMLButtonElement).disabled, false);
});

test('rubric create is blocked when backend template omits criterion levels', () => {
  render(<TeacherRubricsPage embedded courseId="course-1" />);

  fireEvent.click(screen.getByRole('button', { name: /create rubric/i }));

  assert.ok(screen.getByText(/missing levels/i));

  const createButtons = screen.getAllByRole('button', { name: /create rubric/i });
  const submitButton = createButtons[createButtons.length - 1] as HTMLButtonElement;

  assert.equal(submitButton.disabled, true);
  assert.equal(createRubric.mock.calls.length, 0);
});
