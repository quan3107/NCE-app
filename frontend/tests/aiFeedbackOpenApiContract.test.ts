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
