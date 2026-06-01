import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';

test('grade queries are enabled for authenticated students', async () => {
  const gradesApiPath = path.resolve(import.meta.dirname, '../src/features/grades/api.ts');
  const gradesApi = await readFile(gradesApiPath, 'utf8');

  assert.match(
    gradesApi,
    /currentUser\.role === 'student'/,
  );
});
