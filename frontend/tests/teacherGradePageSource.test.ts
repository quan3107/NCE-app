import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';

test('teacher grade page gates the form while the grade query is loading', async () => {
  const source = await readFile(
    path.resolve(
      import.meta.dirname,
      '../src/features/assignments/components/TeacherGradeFormPage.tsx',
    ),
    'utf8',
  );

  assert.match(source, /const\s+gradeQueryIsSettling\s*=\s*gradesQuery\.isLoading/);
  assert.match(source, /gradesQuery\.isFetching\s*&&\s*!gradesQuery\.isFetchedAfterMount/);
  assert.match(source, /if\s*\(\s*gradeQueryIsSettling\s*\)/);
  assert.match(source, /Loading grade/);
  assert.match(source, /if\s*\(\s*gradesQuery\.error\s*\)/);
  assert.match(source, /Unable to load the grade/);
});
