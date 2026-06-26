/**
 * Location: tests/nceLearning.api.test.ts
 * Purpose: Validate student NCE learning frontend API endpoints.
 * Why: Keeps path, attempt, submit, and completion helpers aligned with backend routes.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { before, test } from 'node:test';

type NceLearningApi = typeof import('../src/features/nce-learning/api');

let completeNceLesson: NceLearningApi['completeNceLesson'];
let fetchNceAssetContent: NceLearningApi['fetchNceAssetContent'];
let fetchStudentNcePath: NceLearningApi['fetchStudentNcePath'];
let saveNceAttemptDraft: NceLearningApi['saveNceAttemptDraft'];
let submitNceAttempt: NceLearningApi['submitNceAttempt'];

before(async () => {
  if (typeof process !== 'undefined' && process.env) {
    process.env.VITE_API_BASE_URL = 'http://localhost:4000/api/v1';
  }

  const nceLearningApi = await import('../src/features/nce-learning/api');
  completeNceLesson = nceLearningApi.completeNceLesson;
  fetchNceAssetContent = nceLearningApi.fetchNceAssetContent;
  fetchStudentNcePath = nceLearningApi.fetchStudentNcePath;
  saveNceAttemptDraft = nceLearningApi.saveNceAttemptDraft;
  submitNceAttempt = nceLearningApi.submitNceAttempt;
});

const withFetch = async (
  fetch: typeof globalThis.fetch,
  run: () => Promise<void>,
) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = fetch;

  try {
    await run();
  } finally {
    globalThis.fetch = originalFetch;
  }
};

test('fetchStudentNcePath reads the course path with pagination', async () => {
  const requestedUrls: string[] = [];

  await withFetch(
    async (input) => {
      requestedUrls.push(String(input));
      return new Response(
        JSON.stringify({
          lessons: [],
          pagination: { page: 2, pageSize: 10, total: 0 },
        }),
        { headers: { 'content-type': 'application/json' } },
      );
    },
    async () => {
      const result = await fetchStudentNcePath('course-1', {
        page: 2,
        pageSize: 10,
      });

      assert.deepEqual(result.pagination, { page: 2, pageSize: 10, total: 0 });
    },
  );

  assert.equal(
    requestedUrls[0],
    'http://localhost:4000/api/v1/courses/course-1/nce-path?page=2&pageSize=10',
  );
});

test('fetchNceAssetContent resolves relative audio URLs against the API origin', async () => {
  await withFetch(
    async () =>
      new Response(
        JSON.stringify({
          url: '/api/v1/courses/course-1/nce-assets/content/audio?key=nce%2Flesson.mp3&token=signed',
          mime: 'audio/mpeg',
          size: 123,
        }),
        { headers: { 'content-type': 'application/json' } },
      ),
    async () => {
      const result = await fetchNceAssetContent('course-1', 'nce/lesson.mp3');

      assert.equal(
        result.url,
        'http://localhost:4000/api/v1/courses/course-1/nce-assets/content/audio?key=nce%2Flesson.mp3&token=signed',
      );
    },
  );
});

test('student NCE path types do not require teacher lesson permissions', () => {
  const source = readFileSync(
    new URL('../src/features/nce-learning/types.ts', import.meta.url),
    'utf-8',
  );

  assert.match(source, /StudentNcePathLesson = Omit<NceLesson, 'exercises'>/);
  assert.doesNotMatch(source, /CourseNceLesson/);
});

test('saveNceAttemptDraft posts the response to the course exercise route', async () => {
  const requests: Array<{ url: string; method: string; body: unknown }> = [];

  await withFetch(
    async (input, init) => {
      requests.push({
        url: String(input),
        method: init?.method ?? 'GET',
        body: init?.body ? JSON.parse(String(init.body)) : null,
      });
      return new Response(
        JSON.stringify({
          id: 'attempt-1',
          status: 'draft',
          response: { answer: 'this' },
        }),
        { headers: { 'content-type': 'application/json' } },
      );
    },
    async () => {
      const result = await saveNceAttemptDraft('course-1', 'exercise-1', {
        answer: 'this',
      });

      assert.equal(result.status, 'draft');
    },
  );

  assert.deepEqual(requests[0], {
    url: 'http://localhost:4000/api/v1/courses/course-1/nce-exercises/exercise-1/attempts',
    method: 'POST',
    body: { response: { answer: 'this' } },
  });
});

test('submit and complete helpers call the terminal NCE learning routes', async () => {
  const requests: Array<{ url: string; method: string }> = [];

  await withFetch(
    async (input, init) => {
      requests.push({
        url: String(input),
        method: init?.method ?? 'GET',
      });
      return new Response(JSON.stringify({ status: 'submitted' }), {
        headers: { 'content-type': 'application/json' },
      });
    },
    async () => {
      await submitNceAttempt('attempt-1');
      await completeNceLesson('course-1', 'lesson-1');
    },
  );

  assert.deepEqual(requests, [
    {
      url: 'http://localhost:4000/api/v1/nce-attempts/attempt-1/submit',
      method: 'POST',
    },
    {
      url: 'http://localhost:4000/api/v1/courses/course-1/nce-lessons/lesson-1/complete',
      method: 'POST',
    },
  ]);
});
