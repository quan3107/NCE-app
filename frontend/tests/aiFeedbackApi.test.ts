/**
 * Location: tests/aiFeedbackApi.test.ts
 * Purpose: Verify AI feedback transport helpers and terminal conflict decoding.
 * Why: Batch and single-draft workflows need stable responses for every terminal state.
 */
import assert from 'node:assert/strict';
import { before, test } from 'node:test';

type RequestBatchFn =
  typeof import('../src/features/ai-feedback/api').requestAssignmentWritingFeedbackBatch;
type InvalidateBatchFn =
  typeof import('../src/features/ai-feedback/api').invalidateAssignmentWritingFeedbackBatchQueries;
type FetchWritingStatusFn =
  typeof import('../src/features/ai-feedback/api').fetchWritingFeedbackStatus;
type RequestWritingFn =
  typeof import('../src/features/ai-feedback/api').requestWritingFeedback;
type RegenerateWritingFn =
  typeof import('../src/features/ai-feedback/api').regenerateWritingFeedback;

let requestAssignmentWritingFeedbackBatch: RequestBatchFn;
let invalidateAssignmentWritingFeedbackBatchQueries: InvalidateBatchFn;
let fetchWritingFeedbackStatus: FetchWritingStatusFn;
let requestWritingFeedback: RequestWritingFn;
let regenerateWritingFeedback: RegenerateWritingFn;

before(async () => {
  if (typeof process !== 'undefined' && process.env) {
    process.env.VITE_API_BASE_URL = 'http://localhost:4000/api/v1';
  }

  const apiModule = await import('../src/features/ai-feedback/api');
  requestAssignmentWritingFeedbackBatch = apiModule.requestAssignmentWritingFeedbackBatch;
  invalidateAssignmentWritingFeedbackBatchQueries =
    apiModule.invalidateAssignmentWritingFeedbackBatchQueries;
  fetchWritingFeedbackStatus = apiModule.fetchWritingFeedbackStatus;
  requestWritingFeedback = apiModule.requestWritingFeedback;
  regenerateWritingFeedback = apiModule.regenerateWritingFeedback;
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

const terminalConflict = (
  status: 'rejected' | 'review_required',
) => ({
  id: `draft-${status}`,
  status,
  visibilityMode: 'hidden' as const,
  failureCode:
    status === 'rejected' ? 'unsafe_output' : 'image_context_unavailable',
  failureMessage:
    status === 'rejected'
      ? 'Generated feedback requires teacher review.'
      : 'Required image context is unavailable.',
});

test('status fetch returns rejected draft bodies from terminal conflicts', async () => {
  const response = terminalConflict('rejected');

  await withFetch(
    async () =>
      new Response(JSON.stringify(response), {
        status: 409,
        statusText: 'Conflict',
        headers: { 'content-type': 'application/json' },
      }),
    async () => {
      assert.deepEqual(
        await fetchWritingFeedbackStatus('submission-1'),
        response,
      );
    },
  );
});

test('initial request returns review-required bodies from terminal conflicts', async () => {
  const response = terminalConflict('review_required');

  await withFetch(
    async () =>
      new Response(JSON.stringify(response), {
        status: 409,
        statusText: 'Conflict',
        headers: { 'content-type': 'application/json' },
      }),
    async () => {
      assert.deepEqual(await requestWritingFeedback('submission-2'), response);
    },
  );
});

test('regeneration returns rejected bodies from terminal conflicts', async () => {
  const response = terminalConflict('rejected');

  await withFetch(
    async () =>
      new Response(JSON.stringify(response), {
        status: 409,
        statusText: 'Conflict',
        headers: { 'content-type': 'application/json' },
      }),
    async () => {
      assert.deepEqual(
        await regenerateWritingFeedback({
          submissionId: 'submission-3',
          payload: { providerTier: 'premium' },
        }),
        response,
      );
    },
  );
});

test('batch success invalidates assignment submissions and all writing draft queries', () => {
  const invalidations: unknown[] = [];
  invalidateAssignmentWritingFeedbackBatchQueries({
    invalidateQueries: (filters: unknown) => {
      invalidations.push(filters);
      return Promise.resolve();
    },
  });

  assert.deepEqual(invalidations, [
    { queryKey: ['assignments:submissions'] },
    { queryKey: ['ai-feedback', 'writing'], exact: false },
  ]);
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
