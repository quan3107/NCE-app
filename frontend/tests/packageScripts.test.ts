import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';

test('frontend test scripts pass the tsx glob without shell quotes', async () => {
  const filePath = path.resolve(import.meta.dirname, '../package.json');
  const packageJson = JSON.parse(await readFile(filePath, 'utf8')) as {
    scripts?: Record<string, string>;
  };

  assert.equal(
    packageJson.scripts?.test,
    'tsx --test tests/**/*.test.ts',
    'frontend test script should not quote the tsx test glob',
  );
  assert.equal(
    packageJson.scripts?.['test:coverage'],
    'c8 --reporter=text-summary --reporter=json-summary tsx --test tests/**/*.test.ts',
    'frontend coverage script should not quote the tsx test glob',
  );
});
