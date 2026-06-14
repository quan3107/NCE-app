import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';

function section(source: string, heading: string, nextHeading: string): string {
  const start = source.indexOf(`${heading}:`);
  const end = source.indexOf(`${nextHeading}:`, start + heading.length);

  assert.notEqual(start, -1, `${heading} section should exist`);

  return source.slice(start, end === -1 ? source.length : end);
}

test('AI feedback OpenAPI keeps manual generation separate from finalize docs', async () => {
  const submissionsPath = path.resolve(
    import.meta.dirname,
    '../../docs/openapi/paths/submissions.yaml',
  );
  const submissionsYaml = await readFile(submissionsPath, 'utf8');
  const manualGeneration = section(
    submissionsYaml,
    'SubmissionWritingAiFeedback',
    'SubmissionWritingAiFeedbackDrafts',
  );
  const finalization = section(
    submissionsYaml,
    'SubmissionWritingAiFeedbackFinalize',
    'SubmissionWritingAiFeedbackEnd',
  );

  assert.match(manualGeneration, /^  get:/m);
  assert.match(manualGeneration, /^  post:/m);
  assert.equal((finalization.match(/^  post:/gm) ?? []).length, 1);
  assert.doesNotMatch(finalization, /summary: Request AI writing feedback draft generation/);
});

test('AI feedback review responses document provider and teacher criterion suggestions', async () => {
  const schemasPath = path.resolve(
    import.meta.dirname,
    '../../docs/openapi/schemas/ai-feedback.yaml',
  );
  const schemasYaml = await readFile(schemasPath, 'utf8');
  const providerSuggestion = section(
    schemasYaml,
    'WritingFeedbackProviderCriterionSuggestion',
    'WritingFeedbackApprovalRequest',
  );
  const reviewResponse = section(
    schemasYaml,
    'WritingFeedbackReviewResponse',
    'WritingFeedbackHistoryResponse',
  );

  assert.match(providerSuggestion, /required: \[criterionId, band, rationale\]/);
  assert.match(providerSuggestion, /^    criterionId:/m);
  assert.match(providerSuggestion, /^    band:/m);
  assert.match(providerSuggestion, /^    rationale:/m);
  assert.match(reviewResponse, /^            oneOf:/m);
  assert.match(
    reviewResponse,
    /\$ref: '#\/WritingFeedbackProviderCriterionSuggestion'/,
  );
  assert.match(reviewResponse, /\$ref: '#\/WritingFeedbackCriterionSuggestion'/);
});

test('AI feedback regenerate 409 can return review-required feedback', async () => {
  const submissionsPath = path.resolve(
    import.meta.dirname,
    '../../docs/openapi/paths/submissions.yaml',
  );
  const submissionsYaml = await readFile(submissionsPath, 'utf8');
  const regeneration = section(
    submissionsYaml,
    'SubmissionWritingAiFeedbackRegenerate',
    'SubmissionWritingAiFeedbackApprove',
  );

  assert.match(regeneration, /'409':/);
  assert.match(regeneration, /^              oneOf:/m);
  assert.match(regeneration, /\$ref: '..\/schemas\/ai-feedback.yaml#\/WritingFeedbackResponse'/);
  assert.match(regeneration, /\$ref: '..\/schemas\/common.yaml#\/ErrorResponse'/);
});

test('AI feedback batch generation is assignment-scoped and documents row results', async () => {
  const openapiPath = path.resolve(
    import.meta.dirname,
    '../../docs/openapi/openapi.yaml',
  );
  const schemasPath = path.resolve(
    import.meta.dirname,
    '../../docs/openapi/schemas/ai-feedback.yaml',
  );
  const openapiYaml = await readFile(openapiPath, 'utf8');
  const schemasYaml = await readFile(schemasPath, 'utf8');
  const batchResult = section(
    schemasYaml,
    'WritingFeedbackBatchResult',
    'WritingFeedbackBatchResponse',
  );
  const batchRequest = section(
    schemasYaml,
    'WritingFeedbackBatchRequest',
    'WritingFeedbackBatchResult',
  );

  assert.match(
    openapiYaml,
    /\/api\/v1\/courses\/\{courseId\}\/assignments\/\{assignmentId\}\/ai-feedback\/writing\/batch:/,
  );
  assert.match(batchRequest, /^  oneOf:/m);
  assert.match(batchRequest, /required: \[submissionIds\]/);
  assert.match(batchRequest, /required: \[filter\]/);
  assert.match(
    batchResult,
    /enum: \[queued, review_required, skipped, unauthorized, policy_disabled, failed_to_queue\]/,
  );
});
