/**
 * Location: tests/nceLessonAuthoring.test.ts
 * Purpose: Verify teacher NCE lesson authoring UI source wiring.
 * Why: Keeps routes and mutation states present under the Node-based frontend test runner.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';

const frontendRoot = path.resolve(import.meta.dirname, '..');
const routesPath = path.join(frontendRoot, 'src/routes/AppRoutes.tsx');
const listPagePath = path.join(
  frontendRoot,
  'src/features/nce-content/components/TeacherNceLessonsPage.tsx',
);
const editorPath = path.join(
  frontendRoot,
  'src/features/nce-content/components/TeacherNceLessonEditorPage.tsx',
);
const editorLogicPath = path.join(
  frontendRoot,
  'src/features/nce-content/components/nceLessonEditor.logic.ts',
);
const exerciseEditorPath = path.join(
  frontendRoot,
  'src/features/nce-content/components/NceExerciseEditor.tsx',
);
const objectiveEditorPath = path.join(
  frontendRoot,
  'src/features/nce-content/components/NceObjectiveEditor.tsx',
);

test('AppRoutes exposes teacher NCE lesson authoring routes', async () => {
  const source = await readFile(routesPath, 'utf8');

  assert.match(source, /TeacherNceLessonsPage/);
  assert.match(source, /TeacherNceLessonEditorPage/);
  assert.match(source, /path="teacher\/nce-lessons"/);
  assert.match(source, /path="teacher\/nce-lessons\/new"/);
  assert.match(source, /path="teacher\/nce-lessons\/:lessonId\/edit"/);
});

test('TeacherNceLessonsPage supports draft refresh and publish state', async () => {
  const source = await readFile(listPagePath, 'utf8');

  assert.match(source, /useCourseNceLessonsQuery/);
  assert.match(source, /includeDrafts:\s*true/);
  assert.match(source, /publishNceLesson/);
  assert.match(source, /unpublishNceLesson/);
  assert.match(source, /teacher\/nce-lessons\/new\?\$\{new URLSearchParams/);
  assert.match(source, /Publishing/);
  assert.match(source, /Unpublishing/);
});

test('TeacherNceLessonEditorPage surfaces validation errors and mutation progress', async () => {
  const source = await readFile(editorPath, 'utf8');
  const logicSource = await readFile(editorLogicPath, 'utf8');

  assert.match(source, /createNceLesson/);
  assert.match(source, /assignCreatedLessonToCourse/);
  assert.match(logicSource, /assignCourseNceLessons/);
  assert.match(source, /patchNceLesson/);
  assert.match(logicSource, /assignedCount/);
  assert.match(source, /objectiveCode:\s*lesson\.objectives\.find/);
  assert.match(source, /NceObjectiveEditor/);
  assert.match(source, /NceExerciseEditor/);
  assert.match(source, /Saving/);
  assert.match(source, /errorMessage/);
});

test('NCE objective and exercise editors expose required lesson fields', async () => {
  const objectiveSource = await readFile(objectiveEditorPath, 'utf8');
  const exerciseSource = await readFile(exerciseEditorPath, 'utf8');

  assert.match(objectiveSource, /masteryThreshold/);
  assert.match(objectiveSource, /sortOrder/);
  assert.match(objectiveSource, /category/);
  assert.match(exerciseSource, /exerciseType/);
  assert.match(exerciseSource, /answerKeyText/);
  assert.match(exerciseSource, /scoringConfigText/);
});
