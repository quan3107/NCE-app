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
    'frontend e2e script should run against the actual backend by default',
  );
  assert.equal(
    packageJson.scripts?.['e2e:mocked'],
    'playwright test --config playwright.mocked.config.ts',
    'API-intercepting browser checks should require an explicit mocked command',
  );
  assert.equal(
    packageJson.scripts?.['e2e:synthetic'],
    'playwright test --config playwright.synthetic.config.ts',
    'synthetic cookie races should require an explicit harness command',
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
  assert.match(
    vitestConfig,
    /pool:\s*['"]forks['"]/,
    'component tests should isolate process-wide state such as timezone changes',
  );
  assert.match(
    vitestConfig,
    /execArgv:\s*\[['"]--max-old-space-size=512['"]\]/,
    'component workers should have a hard heap bound if a run is interrupted',
  );
});

test('Playwright separates actual-backend, mocked, and synthetic configurations', async () => {
  const actualPath = path.resolve(import.meta.dirname, '../playwright.config.ts');
  const mockedPath = path.resolve(
    import.meta.dirname,
    '../playwright.mocked.config.ts',
  );
  const syntheticPath = path.resolve(
    import.meta.dirname,
    '../playwright.synthetic.config.ts',
  );
  const realBackendSpecPath = path.resolve(
    import.meta.dirname,
    '../e2e/real-backend.spec.ts',
  );
  const realBackendOrderingPath = path.resolve(
    import.meta.dirname,
    '../e2e/real-backend-auth-ordering.spec.ts',
  );
  const realBackendStorageFailurePath = path.resolve(
    import.meta.dirname,
    '../e2e/real-backend-auth-storage-failure.spec.ts',
  );
  const actual = await readFile(actualPath, 'utf8');
  const mocked = await readFile(mockedPath, 'utf8');
  const synthetic = await readFile(syntheticPath, 'utf8');
  const realBackendSpec = await readFile(realBackendSpecPath, 'utf8');
  const realBackendOrdering = await readFile(realBackendOrderingPath, 'utf8');
  const realBackendStorageFailure = await readFile(
    realBackendStorageFailurePath,
    'utf8',
  );

  assert.match(actual, /PLAYWRIGHT_API_BASE_URL/);
  assert.match(actual, /VITE_API_BASE_URL:\s*apiBaseURL/);
  assert.match(actual, /real-backend\.spec\.ts/);
  assert.match(actual, /real-backend-auth-ordering\.spec\.ts/);
  assert.match(actual, /real-backend-auth-storage-failure\.spec\.ts/);
  assert.doesNotMatch(actual, /classroom-workflow\.spec/);
  assert.doesNotMatch(actual, /profile-layout\.visual\.spec/);
  assert.match(mocked, /classroom-workflow\.spec\.ts/);
  assert.match(mocked, /profile-layout\.visual\.spec\.ts/);
  assert.doesNotMatch(mocked, /auth-cookie-race\.server/);
  assert.match(synthetic, /auth-cookie-race\.server/);
  assert.match(synthetic, /auth-cookie-timeout\.spec\.ts/);
  assert.match(synthetic, /127\.0\.0\.1:4010/);
  assert.match(synthetic, /reuseExistingServer:\s*false/g);
  assert.match(realBackendSpec, /PLAYWRIGHT_API_BASE_URL/);
  assert.match(realBackendSpec, /PLAYWRIGHT_TEST_PASSWORD/);
  assert.match(realBackendSpec, /\/auth\/login/);
  assert.match(realBackendStorageFailure, /Storage\.prototype\.setItem/);
  assert.match(realBackendStorageFailure, /apiClient\('\/me'\)/);
  assert.match(realBackendSpec, /\/me/);
  assert.doesNotMatch(realBackendSpec, /\.route\(/);
  assert.match(realBackendOrdering, /browser\.newContext/);
  assert.match(realBackendOrdering, /\/auth\/refresh/);
  assert.match(realBackendOrdering, /\/auth\/logout/);
  assert.doesNotMatch(
    realBackendSpec,
    /(?:localPassword|password:\s*['"])/,
    'real-backend credentials must come from the environment',
  );
});
