/**
 * Location: tests/nceLearning.components.test.tsx
 * Purpose: Exercise rendered student NCE learning flows.
 * Why: Covers path navigation, draft save, submit, completion, and next lesson behavior.
 */
import assert from 'node:assert/strict';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { afterEach, test } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { StudentNceLessonPage } from '../src/features/nce-learning/components/StudentNceLessonPage';
import { StudentNcePathPage } from '../src/features/nce-learning/components/StudentNcePathPage';
import { NceExerciseAttempt } from '../src/features/nce-learning/components/NceExerciseAttempt';

afterEach(() => {
  cleanup();
});

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
        <Routes>
          <Route path="/student/nce" element={element} />
          <Route
            path="/student/nce/courses/:courseId/lessons/:lessonId"
            element={element}
          />
        </Routes>
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const pathPayload = {
  lessons: [
    {
      id: 'lesson-1',
      unitId: 'unit-1',
      lessonNumber: 1,
      title: 'Excuse me!',
      lessonText: 'Excuse me! Is this your handbag?',
      media: null,
      sortOrder: 1,
      status: 'published',
      publishedAt: '2026-06-20T00:00:00.000Z',
      createdAt: '2026-06-20T00:00:00.000Z',
      updatedAt: '2026-06-20T00:00:00.000Z',
      objectives: [],
      exercises: [
        {
          id: 'exercise-1',
          lessonId: 'lesson-1',
          objectiveId: null,
          exerciseType: 'gap_fill',
          prompt: 'Complete the sentence.',
          content: { sentence: 'Is ___ your handbag?' },
          scoringConfig: { points: 1 },
          sortOrder: 1,
          latestAttempt: null,
        },
      ],
      sequence: 1,
      availableFrom: null,
      dueAt: null,
      progress: null,
    },
    {
      id: 'lesson-2',
      unitId: 'unit-1',
      lessonNumber: 2,
      title: 'Sorry, sir.',
      lessonText: 'Sorry, sir. Is this your umbrella?',
      media: null,
      sortOrder: 2,
      status: 'published',
      publishedAt: '2026-06-20T00:00:00.000Z',
      createdAt: '2026-06-20T00:00:00.000Z',
      updatedAt: '2026-06-20T00:00:00.000Z',
      objectives: [],
      exercises: [],
      sequence: 2,
      availableFrom: null,
      dueAt: null,
      progress: null,
    },
  ],
  pagination: { page: 1, pageSize: 20, total: 2 },
};

const pathPayloadWithPersistedAttempt = {
  ...pathPayload,
  lessons: pathPayload.lessons.map((lesson) => {
    if (lesson.id !== 'lesson-1') {
      return lesson;
    }

    return {
      ...lesson,
      exercises: lesson.exercises.map((exercise) => ({
        ...exercise,
        latestAttempt: {
          id: 'attempt-1',
          courseId: 'course-1',
          lessonId: 'lesson-1',
          exerciseId: 'exercise-1',
          studentId: 'student-1',
          status: 'submitted',
          response: { answer: 'this' },
          score: 1,
          maxScore: 1,
          feedback: { correct: true },
          submittedAt: '2026-06-23T10:00:00.000Z',
          createdAt: '2026-06-23T09:55:00.000Z',
          updatedAt: '2026-06-23T10:00:00.000Z',
        },
      })),
    };
  }),
};

const pathPayloadWithDraftAttempt = {
  ...pathPayload,
  lessons: pathPayload.lessons.map((lesson) => {
    if (lesson.id !== 'lesson-1') {
      return lesson;
    }

    return {
      ...lesson,
      exercises: lesson.exercises.map((exercise) => ({
        ...exercise,
        latestAttempt: {
          id: 'attempt-draft',
          courseId: 'course-1',
          lessonId: 'lesson-1',
          exerciseId: 'exercise-1',
          studentId: 'student-1',
          status: 'draft',
          response: { answer: 'old' },
          score: null,
          maxScore: null,
          feedback: null,
          submittedAt: null,
          createdAt: '2026-06-23T09:55:00.000Z',
          updatedAt: '2026-06-23T09:55:00.000Z',
        },
      })),
    };
  }),
};

const pathPayloadWithMatchingExercise = {
  lessons: [
    {
      ...pathPayload.lessons[0],
      exercises: [
        {
          id: 'exercise-match',
          lessonId: 'lesson-1',
          objectiveId: null,
          exerciseType: 'vocabulary',
          prompt: 'Match each classroom object to its meaning.',
          content: {
            terms: ['handbag', 'pardon'],
            choices: ['a small bag', 'please repeat'],
          },
          scoringConfig: { pointsPerMatch: 1, maxScore: 2 },
          sortOrder: 1,
          latestAttempt: null,
        },
      ],
    },
  ],
  pagination: { page: 1, pageSize: 20, total: 1 },
};

const lateLessonPathPayload = {
  lessons: [
    {
      ...pathPayload.lessons[0],
      id: 'lesson-101',
      lessonNumber: 101,
      title: 'A late assigned lesson',
      exercises: [],
    },
  ],
  pagination: { page: 2, pageSize: 100, total: 101 },
};

const boundaryLessonPathPayload = {
  lessons: [
    {
      ...pathPayload.lessons[0],
      id: 'lesson-100',
      lessonNumber: 100,
      title: 'The boundary lesson',
      exercises: [],
    },
  ],
  pagination: { page: 1, pageSize: 100, total: 101 },
};

test('StudentNcePathPage opens an assigned lesson from a course path', async () => {
  const user = userEvent.setup();
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () =>
    new Response(JSON.stringify(pathPayload), {
      headers: { 'content-type': 'application/json' },
    });

  try {
    renderWithProviders(<StudentNcePathPage />, '/student/nce?courseId=course-1');

    await screen.findByText('Excuse me!');
    await user.click(screen.getByRole('button', { name: /open excuse me/i }));

    assert.equal(
      screen.getByTestId('location').textContent,
      '/student/nce/courses/course-1/lessons/lesson-1',
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('NceExerciseAttempt renders content and loads exercise audio', async () => {
  const originalFetch = globalThis.fetch;
  const requests: string[] = [];

  globalThis.fetch = async (input) => {
    const url = String(input);
    requests.push(url);

    if (url.includes('/nce-assets/content')) {
      return new Response(
        JSON.stringify({
          url: 'https://storage.mock/nce-assets/nce/book1/lesson1/dialogue.mp3',
          mime: 'audio/mpeg',
          size: 1234,
        }),
        { headers: { 'content-type': 'application/json' } },
      );
    }

    throw new Error(`Unexpected request: ${url}`);
  };

  try {
    renderWithProviders(
      <NceExerciseAttempt
        courseId="course-1"
        exercise={{
          id: 'exercise-content',
          lessonId: 'lesson-1',
          objectiveId: null,
          exerciseType: 'listening',
          prompt: 'Listen and answer.',
          content: {
            audioKey: 'nce/book1/lesson1/dialogue.mp3',
            sentence: 'Is ___ your handbag?',
            choices: ['Excuse me', 'Thank you'],
            lines: ['Excuse me.', 'Is this your handbag?'],
          },
          scoringConfig: { maxScore: 1 },
          sortOrder: 1,
          latestAttempt: null,
        }}
        response={{}}
        attempt={null}
        isSaving={false}
        isSubmitting={false}
        onResponseChange={() => undefined}
        onSaveDraft={() => undefined}
        onSubmit={() => undefined}
      />,
      '/student/nce',
    );

    const audio = await screen.findByLabelText('Exercise audio', {}, { timeout: 1000 });
    assert.match((audio as HTMLAudioElement).src, /dialogue\.mp3$/);
    assert.ok(screen.queryByText('nce/book1/lesson1/dialogue.mp3') === null);
    assert.ok(screen.getByText('Is ___ your handbag?'));
    assert.ok(screen.getAllByText('Excuse me').length > 0);
    assert.ok(screen.getAllByText('Thank you').length > 0);
    assert.ok(screen.getByText('Excuse me.'));
    assert.ok(screen.getByText('Is this your handbag?'));
    assert.ok(
      requests.some((url) =>
        url.includes('/courses/course-1/nce-assets/content') &&
        url.includes('key=nce%2Fbook1%2Flesson1%2Fdialogue.mp3'),
      ),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('NceExerciseAttempt renders choices as selectable answers', async () => {
  const user = userEvent.setup();
  let selectedResponse: unknown = null;

  renderWithProviders(
    <NceExerciseAttempt
      courseId="course-1"
      exercise={{
        id: 'exercise-choice',
        lessonId: 'lesson-1',
        objectiveId: null,
        exerciseType: 'multiple_choice',
        prompt: 'Choose the correct phrase.',
        content: {
          choices: ['Excuse me', 'Thank you'],
        },
        scoringConfig: { maxScore: 1 },
        sortOrder: 1,
        latestAttempt: null,
      }}
      response={{}}
      attempt={null}
      isSaving={false}
      isSubmitting={false}
      onResponseChange={(response) => {
        selectedResponse = response;
      }}
      onSaveDraft={() => undefined}
      onSubmit={() => undefined}
    />,
    '/student/nce',
  );

  const answerControl = screen.getByLabelText('Answer for Choose the correct phrase.');
  assert.equal(answerControl.tagName, 'SELECT');

  await user.selectOptions(answerControl, 'Thank you');

  assert.deepEqual(selectedResponse, { answer: 'Thank you' });
});

test('StudentNceLessonPage saves matching exercise pairs', async () => {
  const user = userEvent.setup();
  const originalFetch = globalThis.fetch;
  const requests: Array<{ url: string; method: string; body: unknown }> = [];

  globalThis.fetch = async (input, init) => {
    const url = String(input);
    requests.push({
      url,
      method: init?.method ?? 'GET',
      body: init?.body ? JSON.parse(String(init.body)) : null,
    });

    if (url.includes('/nce-path')) {
      return new Response(JSON.stringify(pathPayloadWithMatchingExercise), {
        headers: { 'content-type': 'application/json' },
      });
    }

    if (url.includes('/attempts') && init?.method === 'POST') {
      return new Response(
        JSON.stringify({
          id: 'attempt-match',
          status: 'draft',
          response: {
            matches: {
              handbag: 'a small bag',
              pardon: 'please repeat',
            },
          },
        }),
        { headers: { 'content-type': 'application/json' } },
      );
    }

    throw new Error(`Unexpected request: ${url}`);
  };

  try {
    renderWithProviders(
      <StudentNceLessonPage />,
      '/student/nce/courses/course-1/lessons/lesson-1',
    );

    await screen.findByText('Match each classroom object to its meaning.');
    await user.selectOptions(screen.getByLabelText('Match handbag'), 'a small bag');
    await user.selectOptions(screen.getByLabelText('Match pardon'), 'please repeat');
    await user.click(screen.getByRole('button', { name: /save draft/i }));
    await screen.findByText(/draft saved/i);

    const draftWrite = requests.find((request) =>
      request.url.endsWith('/courses/course-1/nce-exercises/exercise-match/attempts') &&
      request.method === 'POST',
    );

    assert.deepEqual(draftWrite?.body, {
      response: {
        matches: {
          handbag: 'a small bag',
          pardon: 'please repeat',
        },
      },
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('StudentNceLessonPage saves, submits, and completes', async () => {
  const user = userEvent.setup();
  const originalFetch = globalThis.fetch;
  const requests: Array<{ url: string; method: string; body: unknown }> = [];

  globalThis.fetch = async (input, init) => {
    const url = String(input);
    requests.push({
      url,
      method: init?.method ?? 'GET',
      body: init?.body ? JSON.parse(String(init.body)) : null,
    });

    if (url.includes('/nce-path')) {
      return new Response(JSON.stringify(pathPayload), {
        headers: { 'content-type': 'application/json' },
      });
    }

    if (url.includes('/attempts') && init?.method === 'POST' && !url.includes('/submit')) {
      return new Response(
        JSON.stringify({
          id: 'attempt-1',
          status: 'draft',
          response: { answer: 'this' },
        }),
        { headers: { 'content-type': 'application/json' } },
      );
    }

    if (url.includes('/submit')) {
      return new Response(
        JSON.stringify({
          id: 'attempt-1',
          status: 'submitted',
          score: 1,
          maxScore: 1,
          response: { answer: 'this' },
        }),
        { headers: { 'content-type': 'application/json' } },
      );
    }

    if (url.includes('/complete')) {
      return new Response(
        JSON.stringify({
          status: 'completed',
          completedAt: '2026-06-23T10:00:00.000Z',
        }),
        { headers: { 'content-type': 'application/json' } },
      );
    }

    throw new Error(`Unexpected request: ${url}`);
  };

  try {
    renderWithProviders(
      <StudentNceLessonPage />,
      '/student/nce/courses/course-1/lessons/lesson-1',
    );

    await screen.findByText('Complete the sentence.');
    await user.type(screen.getByLabelText('Answer for Complete the sentence.'), 'this');
    await user.click(screen.getByRole('button', { name: /save draft/i }));
    await screen.findByText(/draft saved/i);

    await user.click(screen.getByRole('button', { name: /submit attempt/i }));
    await screen.findByText(/score: 1\/1/i);

    await user.click(screen.getByRole('button', { name: /mark lesson complete/i }));
    await screen.findByText(/lesson completed/i);

    assert.ok(
      requests.some((request) =>
        request.url.endsWith('/courses/course-1/nce-exercises/exercise-1/attempts') &&
        request.method === 'POST',
      ),
    );
    assert.ok(
      requests.some((request) =>
        request.url.endsWith('/nce-attempts/attempt-1/submit') &&
        request.method === 'POST',
      ),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('StudentNceLessonPage does not carry local completion to the next lesson', async () => {
  const user = userEvent.setup();
  const originalFetch = globalThis.fetch;
  const pathWithoutExercises = {
    ...pathPayload,
    lessons: pathPayload.lessons.map((lesson) => ({
      ...lesson,
      exercises: [],
      progress: null,
    })),
  };

  globalThis.fetch = async (input, init) => {
    const url = String(input);

    if (url.includes('/nce-path')) {
      return new Response(JSON.stringify(pathWithoutExercises), {
        headers: { 'content-type': 'application/json' },
      });
    }

    if (url.includes('/complete') && init?.method === 'POST') {
      return new Response(
        JSON.stringify({
          status: 'completed',
          completedAt: '2026-06-23T10:00:00.000Z',
        }),
        { headers: { 'content-type': 'application/json' } },
      );
    }

    throw new Error(`Unexpected request: ${url}`);
  };

  try {
    renderWithProviders(
      <StudentNceLessonPage />,
      '/student/nce/courses/course-1/lessons/lesson-1',
    );

    await screen.findByRole('heading', { name: 'Excuse me!' }, { timeout: 1000 });
    await user.click(screen.getByRole('button', { name: /mark lesson complete/i }));
    await screen.findByText(/lesson completed/i, undefined, { timeout: 1000 });

    await user.click(screen.getByRole('button', { name: /next lesson/i }));

    assert.equal(
      screen.getByTestId('location').textContent,
      '/student/nce/courses/course-1/lessons/lesson-2',
    );
    await screen.findByRole('heading', { name: 'Sorry, sir.' }, { timeout: 1000 });
    assert.equal(screen.queryByText(/lesson completed/i), null);
    assert.equal(
      (screen.getByRole('button', { name: /mark lesson complete/i }) as HTMLButtonElement)
        .disabled,
      false,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('StudentNceLessonPage hydrates persisted attempts after reload', async () => {
  const user = userEvent.setup();
  const originalFetch = globalThis.fetch;
  const requests: Array<{ url: string; method: string }> = [];

  globalThis.fetch = async (input, init) => {
    const url = String(input);
    requests.push({
      url,
      method: init?.method ?? 'GET',
    });

    if (url.includes('/nce-path')) {
      return new Response(JSON.stringify(pathPayloadWithPersistedAttempt), {
        headers: { 'content-type': 'application/json' },
      });
    }

    if (url.includes('/complete')) {
      return new Response(
        JSON.stringify({
          status: 'completed',
          completedAt: '2026-06-23T10:00:00.000Z',
        }),
        { headers: { 'content-type': 'application/json' } },
      );
    }

    throw new Error(`Unexpected request: ${url}`);
  };

  try {
    renderWithProviders(
      <StudentNceLessonPage />,
      '/student/nce/courses/course-1/lessons/lesson-1',
    );

    const answer = await screen.findByLabelText('Answer for Complete the sentence.');
    assert.equal((answer as HTMLTextAreaElement).value, 'this');
    await screen.findByText(/score: 1\/1/i);

    await user.click(screen.getByRole('button', { name: /mark lesson complete/i }));
    await screen.findByText(/lesson completed/i);

    assert.equal(
      requests.some((request) => request.url.includes('/attempts')),
      false,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('StudentNceLessonPage saves edited draft content before submitting', async () => {
  const user = userEvent.setup();
  const originalFetch = globalThis.fetch;
  const requests: Array<{ url: string; method: string; body: unknown }> = [];

  globalThis.fetch = async (input, init) => {
    const url = String(input);
    requests.push({
      url,
      method: init?.method ?? 'GET',
      body: init?.body ? JSON.parse(String(init.body)) : null,
    });

    if (url.includes('/nce-path')) {
      return new Response(JSON.stringify(pathPayloadWithDraftAttempt), {
        headers: { 'content-type': 'application/json' },
      });
    }

    if (url.includes('/attempts') && init?.method === 'POST' && !url.includes('/submit')) {
      return new Response(
        JSON.stringify({
          id: 'attempt-draft',
          status: 'draft',
          response: { answer: 'new' },
        }),
        { headers: { 'content-type': 'application/json' } },
      );
    }

    if (url.includes('/submit')) {
      return new Response(
        JSON.stringify({
          id: 'attempt-draft',
          status: 'submitted',
          score: 1,
          maxScore: 1,
          response: { answer: 'new' },
        }),
        { headers: { 'content-type': 'application/json' } },
      );
    }

    throw new Error(`Unexpected request: ${url}`);
  };

  try {
    renderWithProviders(
      <StudentNceLessonPage />,
      '/student/nce/courses/course-1/lessons/lesson-1',
    );

    const answer = await screen.findByLabelText('Answer for Complete the sentence.');
    assert.equal((answer as HTMLTextAreaElement).value, 'old');

    await user.clear(answer);
    await user.type(answer, 'new');
    await user.click(screen.getByRole('button', { name: /submit attempt/i }));
    await screen.findByText(/score: 1\/1/i);

    const draftWriteIndex = requests.findIndex((request) =>
      request.url.endsWith('/courses/course-1/nce-exercises/exercise-1/attempts') &&
      request.method === 'POST',
    );
    const submitIndex = requests.findIndex((request) =>
      request.url.endsWith('/nce-attempts/attempt-draft/submit') &&
      request.method === 'POST',
    );

    assert.notEqual(draftWriteIndex, -1);
    assert.notEqual(submitIndex, -1);
    assert.ok(draftWriteIndex < submitIndex);
    assert.deepEqual(requests[draftWriteIndex]?.body, { response: { answer: 'new' } });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('StudentNceLessonPage finds lessons beyond the first path page', async () => {
  const originalFetch = globalThis.fetch;
  const requestedPages: number[] = [];

  globalThis.fetch = async (input) => {
    const url = String(input);

    if (url.includes('/nce-path')) {
      const requestUrl = new URL(url, 'http://localhost');
      const page = Number(requestUrl.searchParams.get('page') ?? '1');
      requestedPages.push(page);

      if (page === 1) {
        return new Response(
          JSON.stringify({
            lessons: [],
            pagination: { page: 1, pageSize: 100, total: 101 },
          }),
          { headers: { 'content-type': 'application/json' } },
        );
      }

      return new Response(JSON.stringify(lateLessonPathPayload), {
        headers: { 'content-type': 'application/json' },
      });
    }

    throw new Error(`Unexpected request: ${url}`);
  };

  try {
    renderWithProviders(
      <StudentNceLessonPage />,
      '/student/nce/courses/course-1/lessons/lesson-101',
    );

    await screen.findByRole('heading', { name: 'A late assigned lesson' });
    assert.deepEqual(requestedPages, [1, 2]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('StudentNceLessonPage keeps next lesson navigation across path pages', async () => {
  const user = userEvent.setup();
  const originalFetch = globalThis.fetch;
  const requestedPages: number[] = [];

  globalThis.fetch = async (input) => {
    const url = String(input);

    if (url.includes('/nce-path')) {
      const requestUrl = new URL(url, 'http://localhost');
      const page = Number(requestUrl.searchParams.get('page') ?? '1');
      requestedPages.push(page);

      if (page === 1) {
        return new Response(JSON.stringify(boundaryLessonPathPayload), {
          headers: { 'content-type': 'application/json' },
        });
      }

      return new Response(JSON.stringify(lateLessonPathPayload), {
        headers: { 'content-type': 'application/json' },
      });
    }

    throw new Error(`Unexpected request: ${url}`);
  };

  try {
    renderWithProviders(
      <StudentNceLessonPage />,
      '/student/nce/courses/course-1/lessons/lesson-100',
    );

    await screen.findByRole('heading', { name: 'The boundary lesson' });
    await user.click(await screen.findByRole('button', { name: /next lesson/i }));

    assert.equal(
      screen.getByTestId('location').textContent,
      '/student/nce/courses/course-1/lessons/lesson-101',
    );
    assert.deepEqual(requestedPages, [1, 2]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
