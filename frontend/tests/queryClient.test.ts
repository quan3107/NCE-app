/// <reference lib="dom" />
/**
 * Location: tests/queryClient.test.ts
 * Purpose: Validate query client cache behavior and API helper wiring.
 * Why: Guards against regressions in query cache usage and request construction.
 */

import { test, before } from 'node:test';
import assert from 'node:assert/strict';
type AddCourseStudent = typeof import('../src/features/courses/management/api').addCourseStudent;
type ArchiveCourse = typeof import('../src/features/courses/management/api').archiveCourse;
type CourseStudentsKey = typeof import('../src/features/courses/management/api').courseStudentsKey;
type ShouldHydrateCourseDetails =
  typeof import('../src/features/courses/management/hooks/useTeacherCourseActions').shouldHydrateCourseDetails;
type RemoveCourseStudent =
  typeof import('../src/features/courses/management/api').removeCourseStudent;
type RestoreCourse = typeof import('../src/features/courses/management/api').restoreCourse;
type UpdateCourseDetails =
  typeof import('../src/features/courses/management/api').updateCourseDetails;
type QueryClientInstance = typeof import('../src/lib/queryClient').queryClient;

const API_BASE_URL = 'http://localhost:4000/api/v1';

let addCourseStudent: AddCourseStudent;
let archiveCourse: ArchiveCourse;
let courseStudentsKey: CourseStudentsKey;
let shouldHydrateCourseDetails: ShouldHydrateCourseDetails;
let removeCourseStudent: RemoveCourseStudent;
let restoreCourse: RestoreCourse;
let updateCourseDetails: UpdateCourseDetails;
let queryClient: QueryClientInstance;

before(async () => {
  if (typeof process !== 'undefined' && process.env) {
    process.env.VITE_API_BASE_URL = API_BASE_URL;
  }

  const apiModule = await import('../src/features/courses/management/api');
  addCourseStudent = apiModule.addCourseStudent;
  archiveCourse = apiModule.archiveCourse;
  courseStudentsKey = apiModule.courseStudentsKey;
  removeCourseStudent = apiModule.removeCourseStudent;
  restoreCourse = apiModule.restoreCourse;
  updateCourseDetails = apiModule.updateCourseDetails;

  const courseActionsModule = await import(
    '../src/features/courses/management/hooks/useTeacherCourseActions'
  );
  shouldHydrateCourseDetails = courseActionsModule.shouldHydrateCourseDetails;

  const queryClientModule = await import('../src/lib/queryClient');
  queryClient = queryClientModule.queryClient;
});

function installCourseManagementFetchMock(
  handler: (input: string, init?: RequestInit) => Response | Promise<Response>,
) {
  const originalFetch = globalThis.fetch;
  const originalLocalStorage = (globalThis as Record<string, unknown>).localStorage;

  const storageMock: Storage = {
    get length() {
      return 0;
    },
    clear: () => undefined,
    getItem: () => null,
    key: () => null,
    removeItem: () => undefined,
    setItem: () => undefined,
  };

  (globalThis as typeof globalThis & { localStorage: Storage }).localStorage = storageMock;
  (globalThis as typeof globalThis & { fetch: typeof fetch }).fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input.toString();
    return handler(url, init);
  };

  return () => {
    (globalThis as typeof globalThis & { fetch: typeof fetch }).fetch = originalFetch;

    if (originalLocalStorage === undefined) {
      delete (globalThis as Record<string, unknown>).localStorage;
    } else {
      (globalThis as typeof globalThis & { localStorage: Storage }).localStorage =
        originalLocalStorage as Storage;
    }
  };
}

test('caches fetch results until invalidated', async () => {
  queryClient.clear();
  let callCount = 0;

  const fetcher = async () => {
    callCount += 1;
    return { value: Math.random() };
  };

  const first = await queryClient.fetchQuery({
    queryKey: ['sample', 'key'],
    queryFn: fetcher,
    staleTime: Infinity,
  });
  const second = await queryClient.fetchQuery({
    queryKey: ['sample', 'key'],
    queryFn: fetcher,
    staleTime: Infinity,
  });

  assert.deepEqual(second, first);
  assert.equal(callCount, 1);
});

test('subscription receives updates when query data changes', () => {
  queryClient.clear();
  let triggered = 0;

  const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
    if (event?.query?.queryKey?.[0] === 'notify') {
      triggered += 1;
    }
  });

  queryClient.setQueryData(['notify', 'key'], { ready: true });
  const triggeredAfterFirst = triggered;
  unsubscribe();
  queryClient.setQueryData(['notify', 'key'], { ready: false });

  assert.ok(triggeredAfterFirst >= 1);
  assert.equal(triggered, triggeredAfterFirst);
});

test('invalidatePrefix clears matching entries', () => {
  queryClient.clear();
  queryClient.setQueryData(['user', '1'], { id: 1 });
  queryClient.setQueryData(['user', '2'], { id: 2 });
  queryClient.setQueryData(['course', '1'], { id: 'course-1' });

  queryClient.removeQueries({
    predicate: (query) =>
      typeof query.queryKey[0] === 'string' &&
      (query.queryKey[0] as string).startsWith('user'),
  });

  assert.equal(queryClient.getQueryData(['user', '1']), undefined);
  assert.equal(queryClient.getQueryData(['user', '2']), undefined);
  assert.deepEqual(queryClient.getQueryData(['course', '1']), { id: 'course-1' });
});

test('addCourseStudent posts to backend and updates roster cache', async () => {
  queryClient.clear();

  const originalFetch = globalThis.fetch;
  const originalLocalStorage = (globalThis as Record<string, unknown>).localStorage;

  const storageMock: Storage = {
    get length() {
      return 0;
    },
    clear: () => undefined,
    getItem: () => null,
    key: () => null,
    removeItem: () => undefined,
    setItem: () => undefined,
  };

  (globalThis as typeof globalThis & { localStorage: Storage }).localStorage = storageMock;

  let capturedUrl: string | null = null;
  let capturedInit: RequestInit | undefined;

  (globalThis as typeof globalThis & { fetch: typeof fetch }).fetch = async (input, init) => {
    capturedUrl = typeof input === 'string' ? input : input.toString();
    capturedInit = init;

    const rawBody = init?.body;
    const bodyText = typeof rawBody === 'string' ? rawBody : '';

    assert.equal(bodyText, JSON.stringify({ email: 'learner@example.com' }));

    const responsePayload = {
      id: 'student-123',
      fullName: 'Learner Example',
      email: 'learner@example.com',
      status: 'active' as const,
      enrolledAt: '2025-10-11T00:00:00.000Z',
    };

    return new Response(JSON.stringify(responsePayload), {
      status: 201,
      headers: { 'content-type': 'application/json' },
    });
  };

  try {
    const result = await addCourseStudent('course-123', { email: 'learner@example.com' });

    assert.equal(result.id, 'student-123');
    assert.equal(capturedUrl, 'http://localhost:4000/api/v1/courses/course-123/students');
    assert.equal(capturedInit?.method, 'POST');

    const headers = new Headers(capturedInit?.headers);
    assert.equal(headers.get('Content-Type'), 'application/json');

    const cached = queryClient.getQueryData<{
      courseId: string;
      students: Array<{ id: string }>;
    }>(courseStudentsKey('course-123'));

    assert.ok(cached);
    assert.equal(cached?.courseId, 'course-123');
    assert.equal(cached?.students.length, 1);
    assert.equal(cached?.students[0]?.id, 'student-123');
  } finally {
    (globalThis as typeof globalThis & { fetch: typeof fetch }).fetch = originalFetch;

    if (originalLocalStorage === undefined) {
      delete (globalThis as Record<string, unknown>).localStorage;
    } else {
      (globalThis as typeof globalThis & { localStorage: Storage }).localStorage =
        originalLocalStorage as Storage;
    }
  }
});

test('updateCourseDetails patches editable course fields and invalidates course caches', async () => {
  queryClient.clear();
  queryClient.setQueryData(['courses', 'list'], [{ id: 'course-123' }]);
  queryClient.setQueryData(['courses', 'detail', 'course-123'], { id: 'course-123' });

  let capturedUrl: string | null = null;
  let capturedInit: RequestInit | undefined;

  const restore = installCourseManagementFetchMock((url, init) => {
    capturedUrl = url;
    capturedInit = init;

    return new Response(
      JSON.stringify({
        id: 'course-123',
        title: 'Updated IELTS',
        description: null,
        ownerId: 'teacher-1',
        createdAt: '2026-05-31T00:00:00.000Z',
        updatedAt: '2026-05-31T00:00:00.000Z',
        deletedAt: null,
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' },
      },
    );
  });

  try {
    await updateCourseDetails('course-123', {
      title: ' Updated IELTS ',
      description: '   ',
      schedule: ' Tuesdays ',
      duration: '8 weeks',
      level: 'Advanced',
      price: '299',
    });

    assert.equal(capturedUrl, 'http://localhost:4000/api/v1/courses/course-123');
    assert.equal(capturedInit?.method, 'PATCH');
    assert.equal(
      capturedInit?.body,
      JSON.stringify({
        title: 'Updated IELTS',
        description: null,
        schedule: {
          label: 'Tuesdays',
          duration: '8 weeks',
          level: 'Advanced',
          price: 299,
        },
      }),
    );
    assert.equal(queryClient.getQueryState(['courses', 'list'])?.isInvalidated, true);
    assert.equal(
      queryClient.getQueryState(['courses', 'detail', 'course-123'])?.isInvalidated,
      true,
    );
  } finally {
    restore();
  }
});

test('removeCourseStudent deletes enrollment, updates roster cache, and invalidates course caches', async () => {
  queryClient.clear();
  queryClient.setQueryData(courseStudentsKey('course-123'), {
    courseId: 'course-123',
    students: [
      { id: 'student-1', fullName: 'Kept', email: 'kept@example.com' },
      { id: 'student-2', fullName: 'Removed', email: 'removed@example.com' },
    ],
  });

  let capturedUrl: string | null = null;
  let capturedInit: RequestInit | undefined;

  const restore = installCourseManagementFetchMock((url, init) => {
    capturedUrl = url;
    capturedInit = init;
    return new Response(null, { status: 204 });
  });

  try {
    await removeCourseStudent('course-123', 'student-2');

    assert.equal(
      capturedUrl,
      'http://localhost:4000/api/v1/courses/course-123/students/student-2',
    );
    assert.equal(capturedInit?.method, 'DELETE');

    const cached = queryClient.getQueryData<{
      courseId: string;
      students: Array<{ id: string }>;
    }>(courseStudentsKey('course-123'));

    assert.deepEqual(
      cached?.students.map((student) => student.id),
      ['student-1'],
    );
    assert.equal(
      queryClient.getQueryState(courseStudentsKey('course-123'))?.isInvalidated,
      true,
    );
  } finally {
    restore();
  }
});

test('archiveCourse posts to backend without invalidating active detail query', async () => {
  queryClient.clear();
  queryClient.setQueryData(['courses', 'detail', 'course-123'], { id: 'course-123' });

  const requests: Array<{ url: string; method?: string }> = [];
  const restore = installCourseManagementFetchMock((url, init) => {
    requests.push({ url, method: init?.method });
    return new Response(
      JSON.stringify({
        id: 'course-123',
        title: 'Course',
        description: null,
        ownerId: 'teacher-1',
        createdAt: '2026-05-31T00:00:00.000Z',
        updatedAt: '2026-05-31T00:00:00.000Z',
        deletedAt: null,
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' },
      },
    );
  });

  try {
    await archiveCourse('course-123');

    assert.deepEqual(requests, [
      {
        url: 'http://localhost:4000/api/v1/courses/course-123/archive',
        method: 'POST',
      },
    ]);
    assert.equal(
      queryClient.getQueryState(['courses', 'detail', 'course-123'])?.isInvalidated,
      false,
    );
  } finally {
    restore();
  }
});

test('restoreCourse posts to backend and invalidates active detail query', async () => {
  queryClient.clear();
  queryClient.setQueryData(['courses', 'detail', 'course-123'], { id: 'course-123' });

  const requests: Array<{ url: string; method?: string }> = [];
  const restore = installCourseManagementFetchMock((url, init) => {
    requests.push({ url, method: init?.method });
    return new Response(
      JSON.stringify({
        id: 'course-123',
        title: 'Course',
        description: null,
        ownerId: 'teacher-1',
        createdAt: '2026-05-31T00:00:00.000Z',
        updatedAt: '2026-05-31T00:00:00.000Z',
        deletedAt: null,
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' },
      },
    );
  });

  try {
    await restoreCourse('course-123');

    assert.deepEqual(requests, [
      {
        url: 'http://localhost:4000/api/v1/courses/course-123/restore',
        method: 'POST',
      },
    ]);
    assert.equal(
      queryClient.getQueryState(['courses', 'detail', 'course-123'])?.isInvalidated,
      true,
    );
  } finally {
    restore();
  }
});

test('shouldHydrateCourseDetails only replaces form state once per course id', () => {
  assert.equal(shouldHydrateCourseDetails(null, 'course-123'), true);
  assert.equal(shouldHydrateCourseDetails('course-123', 'course-123'), false);
  assert.equal(shouldHydrateCourseDetails('course-123', 'course-456'), true);
});
