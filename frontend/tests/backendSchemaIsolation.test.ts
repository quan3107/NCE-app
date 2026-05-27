import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';

test('backend schema types stay local to the frontend package', async () => {
  const filePath = path.resolve(import.meta.dirname, '../src/lib/backend-schema.ts');
  const source = await readFile(filePath, 'utf8');

  assert.equal(
    source.includes('../../../backend/'),
    false,
    'frontend/lib/backend-schema.ts must not import backend source files',
  );
});
