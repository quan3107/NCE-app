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

before(async () => {
  if (typeof process !== 'undefined' && process.env) {
    process.env.VITE_API_BASE_URL = 'http://localhost:4000/api/v1';
  }

  const nceContentApi = await import('../src/features/nce-content/api');
  fetchCourseNceLessons = nceContentApi.fetchCourseNceLessons;
  fetchNceBooks = nceContentApi.fetchNceBooks;
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
