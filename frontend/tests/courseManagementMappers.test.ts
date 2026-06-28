/// <reference lib="dom" />
/**
 * Location: tests/courseManagementMappers.test.ts
 * Purpose: Validate course-management mapping helpers used by the teacher view.
 * Why: Guards page-level error reporting and rubric formatting regressions.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  toCourseManagementPageError,
  toCourseRubricCriteria,
} from '../src/features/courses/management/hooks/useTeacherCourseManagement.mappers';

test('toCourseManagementPageError includes rubric template errors', () => {
  const error = toCourseManagementPageError({
    courseError: null,
    studentsError: null,
    assignmentsError: null,
    rubricTemplateError: new Error('Rubric template unavailable'),
  });

  assert.equal(error, 'Rubric template unavailable');
});

test('toCourseRubricCriteria converts fractional backend weights to percentages', () => {
  const criteria = toCourseRubricCriteria([
    { name: 'Task Achievement', weight: 0.25 },
    { name: 'Coherence', weight: 0.25 },
    { name: 'Vocabulary', weight: 0.25 },
    { name: 'Grammar', weight: 0.25 },
  ]);

  assert.deepEqual(
    criteria.map((criterion) => criterion.weight),
    [25, 25, 25, 25],
  );
});

test('toCourseRubricCriteria preserves percentage backend weights', () => {
  const criteria = toCourseRubricCriteria([
    { name: 'Task Achievement', weight: 25 },
    { name: 'Coherence', weight: 25 },
  ]);

  assert.deepEqual(
    criteria.map((criterion) => criterion.weight),
    [25, 25],
  );
});

test('toCourseRubricCriteria does not fabricate criteria when backend template is empty', () => {
  const criteria = toCourseRubricCriteria([]);

  assert.deepEqual(criteria, []);
});
