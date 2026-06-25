import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';

function section(source: string, heading: string, nextHeading: string): string {
  const start = source.indexOf(`${heading}:`);
  const end = source.indexOf(`${nextHeading}:`, start + heading.length);

  assert.notEqual(start, -1, `${heading} section should exist`);

  return source.slice(start, end === -1 ? source.length : end);
}

function operation(source: string, heading: string, method: string, nextHeading: string): string {
  const routeSection = section(source, heading, nextHeading);
  const start = routeSection.indexOf(`  ${method}:`);

  assert.notEqual(start, -1, `${heading}.${method} operation should exist`);

  const operationBody = routeSection.slice(start + 1);
  const nextOperation = operationBody.search(/\n  (get|post|patch|put|delete):/);
  if (nextOperation !== -1) {
    return routeSection.slice(start, start + 1 + nextOperation);
  }

  return routeSection.slice(start);
}

test('NCE public OpenAPI routes document optional auth for draft reads', async () => {
  const ncePath = path.resolve(
    import.meta.dirname,
    '../../docs/openapi/paths/nce-content.yaml',
  );
  const nceYaml = (await readFile(ncePath, 'utf8')).replace(/\r\n/g, '\n');
  const routeSections = [
    section(nceYaml, 'NceBooks', 'NceBookUnits'),
    section(nceYaml, 'NceBookUnits', 'NceUnitLessons'),
    section(nceYaml, 'NceUnitLessons', 'NceLesson'),
    section(nceYaml, 'NceLesson', 'CourseNceLessons'),
  ];

  for (const routeSection of routeSections) {
    assert.match(routeSection, /^    security:\n      - \{\}\n      - BearerAuth: \[\]/m);
    assert.match(routeSection, /'401':/);
    assert.match(routeSection, /'403':/);
    assert.match(routeSection, /'404':/);
  }
});

test('NCE teacher write OpenAPI routes document the course scope query parameter', async () => {
  const ncePath = path.resolve(
    import.meta.dirname,
    '../../docs/openapi/paths/nce-content.yaml',
  );
  const nceYaml = (await readFile(ncePath, 'utf8')).replace(/\r\n/g, '\n');
  const writeOperations = [
    operation(nceYaml, 'NceLesson', 'patch', 'NceLessonCollection'),
    operation(nceYaml, 'NceLessonCollection', 'post', 'NceLessonPublish'),
    operation(nceYaml, 'NceLessonPublish', 'post', 'NceLessonUnpublish'),
    operation(nceYaml, 'NceLessonUnpublish', 'post', 'CourseNceLessons'),
  ];

  assert.match(nceYaml, /TeacherWriteCourseId:/);
  for (const writeOperation of writeOperations) {
    assert.match(writeOperation, /- \$ref: '#\/components\/parameters\/TeacherWriteCourseId'/);
  }
});

test('NCE teacher write courseId remains optional for admin global authoring', async () => {
  const ncePath = path.resolve(
    import.meta.dirname,
    '../../docs/openapi/paths/nce-content.yaml',
  );
  const nceYaml = (await readFile(ncePath, 'utf8')).replace(/\r\n/g, '\n');
  const parameter = section(nceYaml, 'TeacherWriteCourseId', 'Page');

  assert.doesNotMatch(parameter, /required: true/);
});

test('NCE teacher write OpenAPI routes document duplicate lesson number conflicts', async () => {
  const ncePath = path.resolve(
    import.meta.dirname,
    '../../docs/openapi/paths/nce-content.yaml',
  );
  const nceYaml = (await readFile(ncePath, 'utf8')).replace(/\r\n/g, '\n');
  const writeOperations = [
    operation(nceYaml, 'NceLesson', 'patch', 'NceLessonCollection'),
    operation(nceYaml, 'NceLessonCollection', 'post', 'NceLessonPublish'),
  ];

  for (const writeOperation of writeOperations) {
    assert.match(writeOperation, /'409':/);
    assert.match(writeOperation, /Duplicate lesson number/);
    assert.match(writeOperation, /\$ref: '\.\.\/schemas\/common\.yaml#\/ErrorResponse'/);
  }
});

test('NCE course lesson schema exposes teacher write permissions', async () => {
  const nceSchemaPath = path.resolve(
    import.meta.dirname,
    '../../docs/openapi/schemas/nce-content.yaml',
  );
  const nceYaml = (await readFile(nceSchemaPath, 'utf8')).replace(/\r\n/g, '\n');
  const courseLessonSchema = section(nceYaml, 'CourseNceLesson', 'NceLessonListResponse');

  assert.match(courseLessonSchema, /canEdit:/);
  assert.match(courseLessonSchema, /canPublish:/);
  assert.match(courseLessonSchema, /required: \[sequence, availableFrom, dueAt, canEdit, canPublish\]/);
});

test('NCE write schema documents supported answer key shapes', async () => {
  const nceSchemaPath = path.resolve(
    import.meta.dirname,
    '../../docs/openapi/schemas/nce-content.yaml',
  );
  const nceYaml = (await readFile(nceSchemaPath, 'utf8')).replace(/\r\n/g, '\n');
  const exerciseWriteSchema = section(nceYaml, 'NceExerciseWrite', 'NceLessonCreateRequest');

  assert.match(exerciseWriteSchema, /choice/);
  assert.match(exerciseWriteSchema, /blanks/);
  assert.match(exerciseWriteSchema, /matches/);
  assert.match(exerciseWriteSchema, /sample/);
  assert.match(exerciseWriteSchema, /accepted/);
  assert.match(exerciseWriteSchema, /sentence/);
  assert.doesNotMatch(exerciseWriteSchema, /multiple_choice requires correctChoiceId/);
});

test('NCE learning OpenAPI routes document student attempts and teacher summaries', async () => {
  const openApiPath = path.resolve(
    import.meta.dirname,
    '../../docs/openapi/openapi.yaml',
  );
  const ncePath = path.resolve(
    import.meta.dirname,
    '../../docs/openapi/paths/nce-learning.yaml',
  );
  const nceSchemaPath = path.resolve(
    import.meta.dirname,
    '../../docs/openapi/schemas/nce-learning.yaml',
  );
  const openApiYaml = (await readFile(openApiPath, 'utf8')).replace(/\r\n/g, '\n');
  const ncePathYaml = (await readFile(ncePath, 'utf8')).replace(/\r\n/g, '\n');
  const nceSchemaYaml = (await readFile(nceSchemaPath, 'utf8')).replace(/\r\n/g, '\n');

  assert.match(openApiYaml, /\/api\/v1\/courses\/\{courseId\}\/nce-path:/);
  assert.match(openApiYaml, /\/api\/v1\/courses\/\{courseId\}\/nce-assets\/content:/);
  assert.match(openApiYaml, /\/api\/v1\/courses\/\{courseId\}\/nce-assets\/content\/audio:/);
  assert.match(openApiYaml, /\/api\/v1\/courses\/\{courseId\}\/nce-exercises\/\{exerciseId\}\/attempts:/);
  assert.match(openApiYaml, /\/api\/v1\/nce-attempts\/\{attemptId\}\/submit:/);
  assert.match(openApiYaml, /\/api\/v1\/courses\/\{courseId\}\/nce-lessons\/\{lessonId\}\/complete:/);
  assert.match(openApiYaml, /\/api\/v1\/courses\/\{courseId\}\/nce-attempts:/);

  for (const heading of [
    'StudentNcePath',
    'CourseNceAssetContent',
    'CourseNceExerciseAttempts',
    'NceAttemptSubmit',
    'CourseNceLessonComplete',
    'CourseNceAttemptSummaries',
  ]) {
    const routeSection = section(ncePathYaml, heading, 'components');
    assert.match(routeSection, /security:\n      - BearerAuth: \[\]/);
    assert.match(routeSection, /'401':/);
    assert.match(routeSection, /'403':/);
  }

  assert.match(nceSchemaYaml, /StudentNcePathResponse:/);
  assert.match(nceSchemaYaml, /NceAssetContent:/);
  const assetContentSchema = section(
    nceSchemaYaml,
    'NceAssetContent',
    'NceLessonProgress',
  );
  assert.match(assetContentSchema, /format: uri-reference/);
  assert.match(nceSchemaYaml, /NceAttempt:/);
  assert.match(nceSchemaYaml, /NceAttemptSummaryListResponse:/);

  const audioRoute = section(ncePathYaml, 'CourseNceAssetAudio', 'CourseNceExerciseAttempts');
  assert.match(audioRoute, /name: token/);
  assert.match(audioRoute, /audio\/mpeg:/);
  assert.doesNotMatch(audioRoute, /BearerAuth/);

  const attemptSchema = section(nceSchemaYaml, 'NceAttempt', 'NceAttemptWriteRequest');
  assert.match(attemptSchema, /enum: \[draft, submitted\]/);
  assert.doesNotMatch(attemptSchema, /graded/);

  const progressSchema = section(nceSchemaYaml, 'NceLessonProgress', 'StudentNcePathExercise');
  assert.match(progressSchema, /required: \[status, startedAt, completedAt, updatedAt\]/);
  assert.match(progressSchema, /enum: \[in_progress, completed\]/);
  assert.match(progressSchema, /startedAt:/);
  assert.doesNotMatch(progressSchema, /not_started/);
  assert.doesNotMatch(nceSchemaYaml, /type:\s*['"]?null['"]?/);
  assert.match(nceSchemaYaml, /latestAttempt:[\s\S]*nullable: true/);
  assert.match(nceSchemaYaml, /progress:[\s\S]*nullable: true/);

  const summarySchema = section(nceSchemaYaml, 'NceAttemptSummary', 'NceAttemptSummaryListResponse');
  assert.match(summarySchema, /fullName:/);
  assert.doesNotMatch(summarySchema, /\$ref: '#\/NceAttempt'/);
  assert.doesNotMatch(summarySchema, /response:/);
});
