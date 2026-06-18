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
