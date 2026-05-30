import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';

test('student submission writes do not send client-owned identity fields', async () => {
  const requestTypesPath = path.resolve(
    import.meta.dirname,
    '../src/features/assignments/api.types.ts',
  );
  const studentPagePath = path.resolve(
    import.meta.dirname,
    '../src/features/assignments/components/StudentAssignmentDetailPage.tsx',
  );

  const requestTypes = await readFile(requestTypesPath, 'utf8');
  const studentPage = await readFile(studentPagePath, 'utf8');

  assert.doesNotMatch(
    requestTypes,
    /export type CreateSubmissionRequest = \{[^}]*studentId:/s,
  );
  assert.doesNotMatch(studentPage, /payload:\s*\{[^}]*studentId:/s);
});

test('grade writes do not send client-owned identity fields', async () => {
  const gradesApiPath = path.resolve(import.meta.dirname, '../src/features/grades/api.ts');
  const teacherGradePagePath = path.resolve(
    import.meta.dirname,
    '../src/features/assignments/components/TeacherGradeFormPage.tsx',
  );

  const gradesApi = await readFile(gradesApiPath, 'utf8');
  const teacherGradePage = await readFile(teacherGradePagePath, 'utf8');

  assert.doesNotMatch(
    gradesApi,
    /type UpsertGradeRequest = \{[^}]*graderId:/s,
  );
  assert.doesNotMatch(teacherGradePage, /payload:\s*\{[^}]*graderId:/s);
});
