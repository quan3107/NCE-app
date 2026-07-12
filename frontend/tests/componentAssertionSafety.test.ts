/**
 * Location: tests/componentAssertionSafety.test.ts
 * Purpose: Keep DOM absence assertions from exposing React elements to Node's deep formatter.
 * Why: A failed element-vs-null strict assertion can recursively inspect the React fiber graph.
 */
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';

const unsafeDomAssertion =
  /assert\.(?:equal|strictEqual)\(\s*[^;]{0,500}?(?:queryBy[A-Z]\w*|querySelector)\([^;]{0,500}?\),\s*null\s*,?\s*\)/g;

test('component tests compare DOM absence through primitive values', async () => {
  const testsDirectory = import.meta.dirname;
  const testFiles = (await readdir(testsDirectory))
    .filter((fileName) => fileName.endsWith('.component.test.tsx'));
  const unsafeAssertions: string[] = [];

  for (const fileName of testFiles) {
    const source = await readFile(path.join(testsDirectory, fileName), 'utf8');
    for (const match of source.matchAll(unsafeDomAssertion)) {
      const line = source.slice(0, match.index).split('\n').length;
      unsafeAssertions.push(`${fileName}:${line}`);
    }
  }

  assert.deepEqual(
    unsafeAssertions,
    [],
    'compare query results as booleans so failed assertions never format React DOM nodes',
  );
});
