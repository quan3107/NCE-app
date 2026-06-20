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

test('frontend CI runs rendered component tests', async () => {
  const workflowPath = path.resolve(import.meta.dirname, '../../.github/workflows/ci.yml');
  const workflow = await readFile(workflowPath, 'utf8');

  assert.match(
    workflow,
    /npm run test:components/,
    'frontend CI should run Vitest jsdom component tests',
  );
});

test('CI avoids duplicate branch runs and cancels stale checks', async () => {
  const workflowPath = path.resolve(import.meta.dirname, '../../.github/workflows/ci.yml');
  const workflow = await readFile(workflowPath, 'utf8');

  assert.match(
    workflow,
    /push:\s*\r?\n\s+branches:\s*\r?\n\s+- main/,
    'push CI should only run for main; pull_request covers feature branches',
  );
  assert.match(
    workflow,
    /concurrency:\s*\r?\n\s+group: \$\{\{ github\.workflow \}\}-\$\{\{ github\.event\.pull_request\.number \|\| github\.ref \}\}\s*\r?\n\s+cancel-in-progress: true/,
    'CI should cancel stale checks for the same PR or branch',
  );
  assert.doesNotMatch(
    workflow,
    /^\s+paths:/m,
    'CI should not use path filters',
  );
});

test('CI avoids duplicated expensive checks inside jobs', async () => {
  const workflowPath = path.resolve(import.meta.dirname, '../../.github/workflows/ci.yml');
  const workflow = await readFile(workflowPath, 'utf8');

  assert.doesNotMatch(
    workflow,
    /- name: Test frontend\s*\r?\n\s+run: npm test/,
    'frontend CI should rely on the coverage run instead of running the same tests twice',
  );
  assert.match(
    workflow,
    /- name: Build backend\s*\r?\n\s+run: npx tsc --project tsconfig\.json/,
    'backend CI should compile directly after the Prisma client is already generated',
  );
});

test('CI uses Node 24 and Node 24-compatible official actions', async () => {
  const workflowPath = path.resolve(import.meta.dirname, '../../.github/workflows/ci.yml');
  const workflow = await readFile(workflowPath, 'utf8');

  assert.match(
    workflow,
    /NODE_VERSION: "24"/,
    'CI should run package installs, builds, and tests on Node 24',
  );
  assert.doesNotMatch(
    workflow,
    /actions\/(?:checkout|setup-node)@v4/,
    'CI should not use official actions that run on the deprecated Node 20 action runtime',
  );
  assert.match(
    workflow,
    /actions\/checkout@v6/,
    'CI should use the Node 24-compatible checkout major',
  );
  assert.match(
    workflow,
    /actions\/setup-node@v6/,
    'CI should use the Node 24-compatible setup-node major',
  );
});
