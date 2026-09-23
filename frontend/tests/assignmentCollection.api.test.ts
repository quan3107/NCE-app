/// <reference lib="dom" />
/**
 * Location: tests/assignmentCollection.api.test.ts
 * Purpose: Verify bounded collection pages replace course and assignment request fan-out.
 * Why: Shared dashboards must not create one HTTP request per resource.
 */
import assert from 'node:assert/strict';
import { before, test } from 'node:test';

import { authBridge } from '../src/lib/authBridge';

let fetchAssignments: typeof import('../src/features/assignments/api.requests').fetchAssignments;
let fetchSubmissions: typeof import('../src/features/assignments/api.requests').fetchSubmissions;

before(async () => {
  process.env.VITE_API_BASE_URL = 'http://localhost:4000/api/v1';
  ({ fetchAssignments, fetchSubmissions } = await import('../src/features/assignments/api.requests'));
});

test('assignment and submission reads use collection pages instead of per-item routes', async () => {
  const originalFetch = globalThis.fetch;
  const seen: string[] = [];
  const firstAssignmentPage = Array.from({ length: 100 }, (_, index) => ({ id: `assignment-${index}` }));
  const firstSubmissionPage = Array.from({ length: 100 }, (_, index) => ({ id: `submission-${index}` }));

  authBridge.configure({
    admit: () => ({
      accessToken: 'test-token',
      actorId: 'test-student',
      revision: 1,
      signal: new AbortController().signal,
    }),
    isCurrent: () => true,
    refreshAccessToken: async () => ({ status: 'failed' }),
  });
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    seen.push(url.pathname + url.search);
    const isAssignment = url.pathname.endsWith('/assignments/accessible');
    const isFirstPage = !url.searchParams.has('cursor');
    return new Response(JSON.stringify({
      items: isFirstPage
        ? (isAssignment ? firstAssignmentPage : firstSubmissionPage)
        : [{ id: isAssignment ? 'assignment-last' : 'submission-last' }],
      nextCursor: isFirstPage
        ? (isAssignment ? 'assignment-99' : 'submission-99')
        : null,
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };

  try {
    const assignments = await fetchAssignments();
    const submissions = await fetchSubmissions();
    assert.equal(assignments.length, 101);
    assert.equal(submissions.length, 101);
    assert.deepEqual(seen, [
      '/api/v1/assignments/accessible',
      '/api/v1/assignments/accessible?cursor=assignment-99',
      '/api/v1/submissions/accessible',
      '/api/v1/submissions/accessible?cursor=submission-99',
    ]);
  } finally {
    globalThis.fetch = originalFetch;
    authBridge.reset();
  }
});
