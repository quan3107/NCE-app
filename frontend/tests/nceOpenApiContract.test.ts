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
