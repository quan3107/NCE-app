import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';

test('grade OpenAPI keeps generic rubric criterion names valid', async () => {
  const gradesSchemaPath = path.resolve(
    import.meta.dirname,
    '../../docs/openapi/schemas/grades.yaml',
  );
  const gradesSchema = await readFile(gradesSchemaPath, 'utf8');

  assert.doesNotMatch(gradesSchema, /criterion:\s*\r?\n\s+type: string\s*\r?\n\s+enum:/);
  assert.match(gradesSchema, /For IELTS writing and speaking grades/);
});
