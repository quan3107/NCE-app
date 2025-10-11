import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addCourseStudent, courseStudentsKey } from '../src/features/courses/management/api';
import { queryClient } from '../src/lib/queryClient';

test('caches fetch results until invalidated', async () => {
  queryClient.clear();
  let callCount = 0;

  const fetcher = async () => {
    callCount += 1;
    return { value: Math.random() };
  };

  const first = await queryClient.fetchQuery('sample:key', fetcher);
  const second = await queryClient.fetchQuery('sample:key', fetcher);

  assert.deepEqual(second, first);
  assert.equal(callCount, 1);
});

test('subscription receives updates when query data changes', () => {
  queryClient.clear();
  let triggered = 0;

  const unsubscribe = queryClient.subscribe('notify:key', () => {
    triggered += 1;
  });

  queryClient.setQueryData('notify:key', { ready: true });
  unsubscribe();
  queryClient.setQueryData('notify:key', { ready: false });

  assert.equal(triggered, 1);
});

test('invalidatePrefix clears matching entries', () => {
  queryClient.clear();
  queryClient.setQueryData('user:1', { id: 1 });
  queryClient.setQueryData('user:2', { id: 2 });
  queryClient.setQueryData('course:1', { id: 'course-1' });

  queryClient.invalidatePrefix('user:');

  assert.equal(queryClient.getQueryData('user:1'), undefined);
  assert.equal(queryClient.getQueryData('user:2'), undefined);
  assert.deepEqual(queryClient.getQueryData('course:1'), { id: 'course-1' });
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
