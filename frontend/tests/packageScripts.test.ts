/**
 * Location: frontend/tests/packageScripts.test.ts
 * Purpose: Validate frontend quality scripts and their resource bounds.
 * Why: CI-safe globs and bounded workers keep checks portable and memory-stable.
 */

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';

test('frontend test scripts use CI-expandable globs and bounded concurrency', async () => {
  const filePath = path.resolve(import.meta.dirname, '../package.json');
  const packageJson = JSON.parse(await readFile(filePath, 'utf8')) as {
    scripts?: Record<string, string>;
  };

  assert.equal(
    packageJson.scripts?.test,
    'tsx --test --test-concurrency=2 tests/*.test.ts',
    'frontend tests should expand in CI without spawning an unbounded process pool',
  );
  assert.equal(
    packageJson.scripts?.['test:coverage'],
    'node --import tsx --test --test-concurrency=2 --experimental-test-coverage tests/*.test.ts',
    'frontend coverage should expand in CI without spawning an unbounded process pool',
  );
  assert.equal(
    packageJson.scripts?.['test:components'],
    'vitest run --config vitest.config.ts',
    'frontend component tests should run in Vitest with jsdom',
  );
  assert.equal(
    packageJson.scripts?.e2e,
    'playwright test',
    'frontend e2e script should run the Playwright classroom workflow',
  );
});

test('frontend component tests cap memory-heavy jsdom workers', async () => {
  const filePath = path.resolve(import.meta.dirname, '../vitest.config.ts');
  const vitestConfig = await readFile(filePath, 'utf8');

  assert.match(
    vitestConfig,
    /maxWorkers:\s*2/,
    'component tests should not create one jsdom worker per test file',
  );
});
