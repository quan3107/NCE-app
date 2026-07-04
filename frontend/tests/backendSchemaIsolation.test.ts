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

test('notification status mirror includes backend recovery states', async () => {
  const filePath = path.resolve(import.meta.dirname, '../src/lib/backend-schema.ts');
  const source = await readFile(filePath, 'utf8');

  for (const status of [
    'queued',
    'sending',
    'sent',
    'failed',
    'read',
    'suppressed',
    'dead_letter',
    'delivery_unknown',
  ]) {
    assert.match(source, new RegExp(`'${status}'`));
  }
});
