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

const createRubric = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock('@features/courses/api', () => ({
  useCoursesQuery: () => ({
    data: [{ id: 'course-1', title: 'Writing Course' }],
  }),
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
