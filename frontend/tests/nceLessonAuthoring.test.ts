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
const fallbackNavPath = path.join(
  frontendRoot,
  'src/features/navigation/utils/fallbackNav.ts',
);
const navigationSeedPath = path.resolve(
  frontendRoot,
  '../backend/src/prisma/seeds/navigation.seed.ts',
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
  assert.match(source, /page:\s*page/);
  assert.match(source, /publishNceLesson/);
  assert.match(source, /unpublishNceLesson/);
  assert.match(source, /teacher\/nce-lessons\/new\?\$\{new URLSearchParams/);
  assert.match(source, /Previous/);
  assert.match(source, /Next/);
  assert.match(source, /pagination\.total/);
  assert.match(source, /Publishing/);
  assert.match(source, /Unpublishing/);
});

test('teacher navigation exposes NCE lesson authoring entry points', async () => {
  const fallbackSource = await readFile(fallbackNavPath, 'utf8');
  const seedSource = await readFile(navigationSeedPath, 'utf8');

  assert.match(fallbackSource, /teacher-nce-lessons/);
  assert.match(fallbackSource, /NCE Lessons/);
  assert.match(fallbackSource, /\/teacher\/nce-lessons/);
  assert.match(seedSource, /NCE Lessons/);
  assert.match(seedSource, /\/teacher\/nce-lessons/);
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

test('assignCreatedLessonToCourse preserves assignments from every course lesson page', async () => {
  process.env.VITE_API_BASE_URL = 'http://localhost:4000/api/v1';
  const { assignCreatedLessonToCourse } = await import(
    '../src/features/nce-content/components/nceLessonEditor.logic'
  );
  const requests: Array<{ url: string; method: string; body: unknown }> = [];
  const firstPageLessons = Array.from({ length: 100 }, (_, index) => ({
    id: `lesson-${index + 1}`,
    sequence: index + 1,
    availableFrom: null,
    dueAt: null,
  }));
  const secondPageLessons = [
    {
      id: 'lesson-101',
      sequence: 101,
      availableFrom: '2026-06-20T00:00:00.000Z',
      dueAt: '2026-06-27T00:00:00.000Z',
    },
  ];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (input, init) => {
    requests.push({
      url: String(input),
      method: init?.method ?? 'GET',
      body: init?.body ? JSON.parse(String(init.body)) : null,
    });

    if (init?.method === 'PUT') {
      return new Response(
        JSON.stringify({ courseId: 'course-1', assignedCount: 102 }),
        { headers: { 'content-type': 'application/json' } },
      );
    }

    const url = new URL(String(input));
    const page = Number(url.searchParams.get('page') ?? '1');
    return new Response(
      JSON.stringify({
        lessons: page === 1 ? firstPageLessons : secondPageLessons,
        pagination: { page, pageSize: 100, total: 101 },
      }),
      { headers: { 'content-type': 'application/json' } },
    );
  };

  try {
    await assignCreatedLessonToCourse('course-1', 'new-lesson');
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(requests[0]?.url.includes('page=1'), true);
  assert.equal(requests[1]?.url.includes('page=2'), true);
  const assignedLessons = (
    requests[2]?.body as { lessons: Array<{ lessonId: string; sequence: number }> }
  ).lessons;
  assert.equal(assignedLessons.length, 102);
  assert.deepEqual(assignedLessons.at(-2), {
    lessonId: 'lesson-101',
    sequence: 101,
    availableFrom: '2026-06-20T00:00:00.000Z',
    dueAt: '2026-06-27T00:00:00.000Z',
  });
  assert.deepEqual(assignedLessons.at(-1), {
    lessonId: 'new-lesson',
    sequence: 102,
  });
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
