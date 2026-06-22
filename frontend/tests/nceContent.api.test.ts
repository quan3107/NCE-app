/**
 * Location: tests/nceContent.api.test.ts
 * Purpose: Validate NCE content frontend API endpoints.
 * Why: Keeps client fetch helpers aligned with the backend read-only NCE routes.
 */
import assert from 'node:assert/strict';
import { before, test } from 'node:test';

type NceContentApi = typeof import('../src/features/nce-content/api');

let fetchCourseNceLessons: NceContentApi['fetchCourseNceLessons'];
let fetchNceBooks: NceContentApi['fetchNceBooks'];
let assignCourseNceLessons: NceContentApi['assignCourseNceLessons'];
let createNceLesson: NceContentApi['createNceLesson'];
let patchNceLesson: NceContentApi['patchNceLesson'];
let publishNceLesson: NceContentApi['publishNceLesson'];
let unpublishNceLesson: NceContentApi['unpublishNceLesson'];

before(async () => {
  if (typeof process !== 'undefined' && process.env) {
    process.env.VITE_API_BASE_URL = 'http://localhost:4000/api/v1';
  }

  const nceContentApi = await import('../src/features/nce-content/api');
  assignCourseNceLessons = nceContentApi.assignCourseNceLessons;
  createNceLesson = nceContentApi.createNceLesson;
  fetchCourseNceLessons = nceContentApi.fetchCourseNceLessons;
  fetchNceBooks = nceContentApi.fetchNceBooks;
  patchNceLesson = nceContentApi.patchNceLesson;
  publishNceLesson = nceContentApi.publishNceLesson;
  unpublishNceLesson = nceContentApi.unpublishNceLesson;
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

test('fetchNceBooks reads the public NCE catalog without auth', async () => {
  const requestedUrls: string[] = [];

  await withFetch(
    async (input) => {
      requestedUrls.push(String(input));
      return new Response(JSON.stringify({ books: [] }), {
        headers: { 'content-type': 'application/json' },
      });
    },
    async () => {
      const result = await fetchNceBooks();

      assert.deepEqual(result, { books: [] });
    },
  );

  assert.equal(requestedUrls[0], 'http://localhost:4000/api/v1/nce/books');
});

test('fetchNceBooks can send course context for teacher draft reads', async () => {
  const requestedUrls: string[] = [];

  await withFetch(
    async (input) => {
      requestedUrls.push(String(input));
      return new Response(JSON.stringify({ books: [] }), {
        headers: { 'content-type': 'application/json' },
      });
    },
    async () => {
      await fetchNceBooks({
        includeDrafts: true,
        courseId: 'course-1',
      });
    },
  );

  assert.equal(
    requestedUrls[0],
    'http://localhost:4000/api/v1/nce/books?includeDrafts=true&courseId=course-1',
  );
});

test('fetchCourseNceLessons forwards draft and pagination filters', async () => {
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
      const result = await fetchCourseNceLessons('course-1', {
        includeDrafts: true,
        page: 2,
        pageSize: 10,
      });

      assert.deepEqual(result.pagination, { page: 2, pageSize: 10, total: 0 });
    },
  );

  assert.equal(
    requestedUrls[0],
    'http://localhost:4000/api/v1/courses/course-1/nce-lessons?includeDrafts=true&page=2&pageSize=10',
  );
});

test('NCE lesson authoring helpers call mutation endpoints with JSON bodies', async () => {
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
          id: 'lesson-1',
          status: 'draft',
          objectives: [],
          exercises: [],
        }),
        { headers: { 'content-type': 'application/json' } },
      );
    },
    async () => {
      await createNceLesson({
        unitId: 'unit-1',
        lessonNumber: 7,
        title: 'Too late',
        lessonText: 'The train has already left.',
        objectives: [],
        exercises: [],
      }, 'course-1');
      await patchNceLesson('lesson-1', { title: 'Too late!' }, 'course-1');
      await publishNceLesson('lesson-1', 'course-1');
      await unpublishNceLesson('lesson-1', 'course-1');
    },
  );

  assert.deepEqual(
    requests.map((request) => [request.method, request.url]),
    [
      ['POST', 'http://localhost:4000/api/v1/nce/lessons?courseId=course-1'],
      ['PATCH', 'http://localhost:4000/api/v1/nce/lessons/lesson-1?courseId=course-1'],
      ['POST', 'http://localhost:4000/api/v1/nce/lessons/lesson-1/publish?courseId=course-1'],
      ['POST', 'http://localhost:4000/api/v1/nce/lessons/lesson-1/unpublish?courseId=course-1'],
    ],
  );
  assert.equal((requests[0]?.body as { title?: string }).title, 'Too late');
  assert.equal((requests[1]?.body as { title?: string }).title, 'Too late!');
});

test('assignCourseNceLessons replaces course NCE lesson sequence', async () => {
  const requests: Array<{ url: string; method: string; body: unknown }> = [];

  await withFetch(
    async (input, init) => {
      requests.push({
        url: String(input),
        method: init?.method ?? 'GET',
        body: init?.body ? JSON.parse(String(init.body)) : null,
      });
      return new Response(
        JSON.stringify({ courseId: 'course-1', assignedCount: 1 }),
        { headers: { 'content-type': 'application/json' } },
      );
    },
    async () => {
      const result = await assignCourseNceLessons('course-1', {
        lessons: [
          {
            lessonId: 'lesson-1',
            sequence: 1,
            availableFrom: '2026-06-20T00:00:00.000Z',
            dueAt: '2026-06-27T00:00:00.000Z',
          },
        ],
      });

      assert.deepEqual(result, { courseId: 'course-1', assignedCount: 1 });
    },
  );

  assert.equal(requests[0]?.method, 'PUT');
  assert.equal(
    requests[0]?.url,
    'http://localhost:4000/api/v1/courses/course-1/nce-lessons',
  );
  assert.deepEqual(requests[0]?.body, {
    lessons: [
      {
        lessonId: 'lesson-1',
        sequence: 1,
        availableFrom: '2026-06-20T00:00:00.000Z',
        dueAt: '2026-06-27T00:00:00.000Z',
      },
    ],
  });
});
