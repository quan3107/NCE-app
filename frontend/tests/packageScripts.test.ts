import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';

test('frontend test scripts use CI-expandable test globs', async () => {
  const filePath = path.resolve(import.meta.dirname, '../package.json');
  const packageJson = JSON.parse(await readFile(filePath, 'utf8')) as {
    scripts?: Record<string, string>;
  };

  assert.equal(
    packageJson.scripts?.test,
    'tsx --test tests/*.test.ts',
    'frontend test script should use a glob that expands in the CI shell',
  );
  assert.equal(
    packageJson.scripts?.['test:coverage'],
    'node --import tsx --test --experimental-test-coverage tests/*.test.ts',
    'frontend coverage script should use Node coverage with a glob that expands in the CI shell',
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
