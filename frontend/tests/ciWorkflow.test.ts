import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';

test('frontend CI runs the classroom e2e workflow', async () => {
  const workflowPath = path.resolve(import.meta.dirname, '../../.github/workflows/ci.yml');
  const workflow = await readFile(workflowPath, 'utf8');

  assert.match(
    workflow,
    /npx playwright install --with-deps chromium/,
    'frontend CI should install the Playwright Chromium browser',
  );
  assert.match(
    workflow,
    /npm run e2e/,
    'frontend CI should run the classroom Playwright workflow',
  );
});
