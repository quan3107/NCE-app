/**
 * Location: tests/nceLessonAuthoring.component.test.tsx
 * Purpose: Exercise rendered NCE lesson authoring flows.
 * Why: Covers button gating and add/remove/save behavior that source-string tests cannot prove.
 */
import assert from 'node:assert/strict';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { afterEach, test } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { TeacherNceLessonEditorPage } from '../src/features/nce-content/components/TeacherNceLessonEditorPage';
import { TeacherNceLessonsPage } from '../src/features/nce-content/components/TeacherNceLessonsPage';

afterEach(() => {
  cleanup();
});

function setWindowPath(path: string) {
  window.history.replaceState(null, '', path);
}

function LocationProbe() {
  const location = useLocation();
  return (
    <output data-testid="location">
      {location.pathname}
      {location.search}
    </output>
  );
}

function renderWithProviders(element: React.ReactElement, initialEntry: string) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        {element}
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

test('TeacherNceLessonsPage disables New Lesson until a courseId is present', async () => {
  const user = userEvent.setup();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error('No course-scoped lesson request should run without a courseId');
  };

  try {
    setWindowPath('/teacher/nce-lessons');
    renderWithProviders(<TeacherNceLessonsPage />, '/teacher/nce-lessons');

    const disabledButton = screen.getByRole('button', { name: /new lesson/i });
    assert.equal((disabledButton as HTMLButtonElement).disabled, true);
    await user.click(disabledButton);
    assert.equal(screen.getByTestId('location').textContent, '/teacher/nce-lessons');

    cleanup();

    const requestedUrls: string[] = [];
    globalThis.fetch = async (input) => {
      requestedUrls.push(String(input));
      return new Response(JSON.stringify({
        lessons: [],
        pagination: { page: 1, pageSize: 100, total: 0 },
      }), {
        headers: { 'content-type': 'application/json' },
      });
    };

    setWindowPath('/teacher/nce-lessons?courseId=course-123');
    renderWithProviders(
      <TeacherNceLessonsPage />,
      '/teacher/nce-lessons?courseId=course-123',
    );

    const enabledButton = screen.getByRole('button', { name: /new lesson/i });
    assert.equal((enabledButton as HTMLButtonElement).disabled, false);
    await user.click(enabledButton);

    assert.equal(
      screen.getByTestId('location').textContent,
      '/teacher/nce-lessons/new?courseId=course-123',
    );
    assert.ok(requestedUrls.some((url) => url.includes('/courses/course-123/nce-lessons')));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('TeacherNceLessonEditorPage keeps add-after-remove keys unique in the saved payload', async () => {
  const user = userEvent.setup();
  const originalFetch = globalThis.fetch;
  let capturedPayload: Record<string, unknown> | null = null;

  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.includes('/nce/lessons') && init?.method === 'POST') {
      capturedPayload = JSON.parse(String(init.body)) as Record<string, unknown>;
      return new Response(JSON.stringify({
        id: 'lesson-1',
        unitId: 'unit-1',
        lessonNumber: 1,
        title: 'Lesson title',
        lessonText: 'Lesson text',
        media: null,
        sortOrder: 1,
        status: 'draft',
        publishedAt: null,
        createdAt: '2026-06-20T00:00:00.000Z',
        updatedAt: '2026-06-20T00:00:00.000Z',
        teacherNotes: null,
        objectives: [],
        exercises: [],
      }), {
        headers: { 'content-type': 'application/json' },
      });
    }

    throw new Error(`Unexpected request: ${url}`);
  };

  try {
    setWindowPath('/teacher/nce-lessons/new?courseId=course-123');
    renderWithProviders(
      <TeacherNceLessonEditorPage />,
      '/teacher/nce-lessons/new?courseId=course-123',
    );

    await user.type(screen.getByLabelText('Unit ID'), 'unit-1');
    await user.type(screen.getByLabelText('Title'), 'Lesson title');
    await user.type(screen.getByLabelText('Lesson Text'), 'Lesson text');

    await user.click(screen.getByRole('button', { name: /add objective/i }));
    await user.click(screen.getByRole('button', { name: /add objective/i }));
    await user.click(screen.getAllByLabelText('Remove objective')[0]);
    await user.click(screen.getByRole('button', { name: /add objective/i }));

    const objectiveCodeInputs = screen.getAllByLabelText('Code') as HTMLInputElement[];
    assert.deepEqual(
      objectiveCodeInputs.map((input) => input.value),
      ['objective-2', 'objective-3'],
    );

    const titleInputs = screen.getAllByLabelText('Title') as HTMLInputElement[];
    await user.type(titleInputs[1], 'Objective two');
    await user.type(titleInputs[2], 'Objective three');

    await user.click(screen.getByRole('button', { name: /add exercise/i }));
    await user.click(screen.getByRole('button', { name: /add exercise/i }));
    await user.click(screen.getAllByLabelText('Remove exercise')[0]);
    await user.click(screen.getByRole('button', { name: /add exercise/i }));

    const exercisePrompts = screen.getAllByLabelText('Prompt') as HTMLTextAreaElement[];
    fireEvent.change(exercisePrompts[0], { target: { value: 'Prompt two' } });
    fireEvent.change(exercisePrompts[1], { target: { value: 'Prompt three' } });

    const answerKeys = screen.getAllByLabelText('Answer Key JSON') as HTMLTextAreaElement[];
    fireEvent.change(answerKeys[0], { target: { value: '{"answers":["two"]}' } });
    fireEvent.change(answerKeys[1], { target: { value: '{"answers":["three"]}' } });

    await user.click(screen.getByRole('button', { name: /save lesson/i }));
    await waitFor(() => assert.notEqual(capturedPayload, null));

    const payload = capturedPayload as {
      objectives: Array<{ code: string; sortOrder: number; clientId?: string }>;
      exercises: Array<{ exerciseType: string; sortOrder: number; clientId?: string }>;
    };

    assert.deepEqual(
      payload.objectives.map((objective) => objective.code),
      ['objective-2', 'objective-3'],
    );
    assert.deepEqual(
      payload.objectives.map((objective) => objective.sortOrder),
      [2, 3],
    );
    assert.deepEqual(
      payload.exercises.map((exercise) => `${exercise.exerciseType}:${exercise.sortOrder}`),
      ['gap_fill:2', 'gap_fill:3'],
    );
    assert.equal(payload.objectives.some((objective) => 'clientId' in objective), false);
    assert.equal(payload.exercises.some((exercise) => 'clientId' in exercise), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
