/**
 * Location: tests/nceLessonAuthoring.test.ts
 * Purpose: Verify teacher NCE lesson authoring UI source wiring.
 * Why: Keeps routes and mutation states present under the Node-based frontend test runner.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

const frontendRoot = path.resolve(import.meta.dirname, "..");
const routesPath = path.join(frontendRoot, "src/routes/AppRoutes.tsx");
const listPagePath = path.join(
  frontendRoot,
  "src/features/nce-content/components/TeacherNceLessonsPage.tsx",
);
const editorPath = path.join(
  frontendRoot,
  "src/features/nce-content/components/TeacherNceLessonEditorPage.tsx",
);
const editorLogicPath = path.join(
  frontendRoot,
  "src/features/nce-content/components/nceLessonEditor.logic.ts",
);
const exerciseEditorPath = path.join(
  frontendRoot,
  "src/features/nce-content/components/NceExerciseEditor.tsx",
);
const objectiveEditorPath = path.join(
  frontendRoot,
  "src/features/nce-content/components/NceObjectiveEditor.tsx",
);
const referenceDefaultsPath = path.resolve(
  frontendRoot,
  "../backend/src/prisma/seeds/referenceBootstrap.data.ts",
);

test("AppRoutes exposes teacher NCE lesson authoring routes", async () => {
  const source = await readFile(routesPath, "utf8");

  assert.match(source, /TeacherNceLessonsPage/);
  assert.match(source, /TeacherNceLessonEditorPage/);
  assert.match(source, /path="teacher\/nce-lessons"/);
  assert.match(source, /path="teacher\/nce-lessons\/new"/);
  assert.match(source, /path="teacher\/nce-lessons\/:lessonId\/edit"/);
});

test("TeacherNceLessonsPage supports draft refresh and publish state", async () => {
  const source = await readFile(listPagePath, "utf8");

  assert.match(source, /useCourseNceLessonsQuery/);
  assert.match(source, /includeDrafts:\s*true/);
  assert.match(source, /page:\s*page/);
  assert.match(source, /publishNceLesson/);
  assert.match(source, /unpublishNceLesson/);
  assert.match(source, /publishNceLesson\(lessonId,\s*courseId\)/);
  assert.match(source, /unpublishNceLesson\(lessonId,\s*courseId\)/);
  assert.match(source, /lesson\.canEdit/);
  assert.match(source, /lesson\.canPublish/);
  assert.match(source, /teacher\/nce-lessons\/new\?\$\{new URLSearchParams/);
  assert.doesNotMatch(source, /:\s*'\/teacher\/nce-lessons\/new'/);
  assert.match(source, /disabled=\{!courseId\}/);
  assert.match(source, /Previous/);
  assert.match(source, /Next/);
  assert.match(source, /pagination\.total/);
  assert.match(source, /Publishing/);
  assert.match(source, /Unpublishing/);
});

test("teacher navigation exposes NCE lesson authoring entry points", async () => {
  const seedSource = await readFile(referenceDefaultsPath, "utf8");

  assert.match(seedSource, /NCE Lessons/);
  assert.match(seedSource, /\/teacher\/nce-lessons/);
});

test("student navigation exposes NCE learning path entry points", async () => {
  const seedSource = await readFile(referenceDefaultsPath, "utf8");

  assert.match(
    seedSource,
    /\[UserRole\.student, 'NCE Path', '\/student\/nce', 'book-open', 'courses:read'/,
  );
  assert.match(
    seedSource,
    /\['courses:read', 'Read Courses', \[UserRole\.student, UserRole\.teacher, UserRole\.admin\]\]/,
  );
});

test("TeacherNceLessonEditorPage surfaces validation errors and mutation progress", async () => {
  const source = await readFile(editorPath, "utf8");

  assert.match(source, /createNceLesson/);
  assert.match(
    source,
    /createNceLesson\(payload as NceLessonWritePayload,\s*courseId\)/,
  );
  assert.doesNotMatch(source, /assignCreatedLessonToCourse/);
  assert.match(source, /patchNceLesson/);
  assert.match(source, /patchNceLesson\(lessonId,\s*payload,\s*courseId\)/);
  assert.match(source, /objectiveCode:\s*lesson\.objectives\.find/);
  assert.match(source, /NceObjectiveEditor/);
  assert.match(source, /NceExerciseEditor/);
  assert.match(source, /Saving/);
  assert.match(source, /errorMessage/);
  assert.match(source, /isDirty/);
  assert.match(source, /hydratedLessonId/);
  assert.match(source, /setIsDirty\(true\)/);
  assert.match(source, /useState<ObjectiveDraft\[\]>\(\[\]\)/);
  assert.match(source, /useState<ExerciseDraft\[\]>\(\[\]\)/);
  assert.match(
    source,
    /scoringConfigText:\s*stringifyNullableJson\(exercise\.scoringConfig\)/,
  );
  assert.match(source, /key=\{objective\.clientId\}/);
  assert.match(source, /nextObjectiveSortOrder/);
  assert.match(source, /nextExerciseSortOrder/);
  assert.match(source, /key=\{exercise\.clientId\}/);
  assert.doesNotMatch(source, /emptyObjective\(items\.length\)/);
  assert.doesNotMatch(source, /emptyExercise\(items\.length\)/);
});

test("NCE objective and exercise editors expose required lesson fields", async () => {
  const objectiveSource = await readFile(objectiveEditorPath, "utf8");
  const exerciseSource = await readFile(exerciseEditorPath, "utf8");

  assert.match(objectiveSource, /masteryThreshold/);
  assert.match(objectiveSource, /sortOrder/);
  assert.match(objectiveSource, /category/);
  assert.match(exerciseSource, /exerciseType/);
  assert.match(exerciseSource, /answerKeyText/);
  assert.match(exerciseSource, /scoringConfigText/);
});

test("empty NCE exercises do not default to a blank answer string", async () => {
  const logicSource = await readFile(editorLogicPath, "utf8");

  assert.doesNotMatch(logicSource, /answers:\s*\[''\]/);
  assert.match(logicSource, /answers:\s*\[\]/);
});
