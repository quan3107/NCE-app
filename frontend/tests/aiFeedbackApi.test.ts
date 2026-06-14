/**
 * Location: tests/aiFeedbackApi.test.ts
 * Purpose: Verify AI feedback transport helpers.
 * Why: Batch writing generation needs a stable assignment-scoped API contract.
 */
import assert from 'node:assert/strict';
import { before, test } from 'node:test';

type RequestBatchFn =
  typeof import('../src/features/ai-feedback/api').requestAssignmentWritingFeedbackBatch;

let requestAssignmentWritingFeedbackBatch: RequestBatchFn;

before(async () => {
  if (typeof process !== 'undefined' && process.env) {
    process.env.VITE_API_BASE_URL = 'http://localhost:4000/api/v1';
  }

  const apiModule = await import('../src/features/ai-feedback/api');
  requestAssignmentWritingFeedbackBatch = apiModule.requestAssignmentWritingFeedbackBatch;
});

test('requestAssignmentWritingFeedbackBatch posts assignment-scoped submission IDs', async () => {
  const originalFetch = globalThis.fetch;
  let capturedUrl: string | null = null;
  let capturedInit: RequestInit | undefined;

  globalThis.fetch = async (input, init) => {
    capturedUrl = String(input);
    capturedInit = init;

    return new Response(
      JSON.stringify({
        assignmentId: 'assignment-1',
        requestedCount: 2,
        results: [
          { submissionId: 'submission-1', status: 'queued' },
          { submissionId: 'submission-2', status: 'skipped' },
        ],
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' },
      },
    );
  };

  try {
    const response = await requestAssignmentWritingFeedbackBatch({
      courseId: 'course-1',
      assignmentId: 'assignment-1',
      payload: { submissionIds: ['submission-1', 'submission-2'] },
    });

    assert.equal(
      capturedUrl,
      'http://localhost:4000/api/v1/courses/course-1/assignments/assignment-1/ai-feedback/writing/batch',
    );
    assert.equal(capturedInit?.method, 'POST');
    assert.equal(
      capturedInit?.body,
      JSON.stringify({ submissionIds: ['submission-1', 'submission-2'] }),
    );
    assert.equal(response.requestedCount, 2);
    assert.equal(response.results[1]?.status, 'skipped');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
