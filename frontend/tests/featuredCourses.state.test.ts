/**
 * Location: tests/featuredCourses.state.test.ts
 * Purpose: Validate FeaturedCourses backend-first state behavior and fallback log payload.
 * Why: Protects against regressions that could reintroduce fabricated marketing course data.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Course } from '../src/types/domain/courses';
import {
  buildFeaturedCoursesFallbackLog,
  resolveFeaturedCoursesState,
} from '../src/components/marketing/featuredCourses.state';

const sampleCourse: Course = {
  id: 'course-1',
  title: 'IELTS Foundations',
  description: 'Build core IELTS reading and writing skills.',
  schedule: 'Mon 18:00',
  teacher: 'Teacher One',
  teacherId: 'teacher-1',
};

test('returns loading mode when query is pending with no backend courses', () => {
  const state = resolveFeaturedCoursesState({
    backendCourses: undefined,
    isLoading: true,
    error: null,
  });

  assert.equal(state.mode, 'loading');
  assert.equal(state.showSkeletons, true);
  assert.equal(state.courses.length, 0);
  assert.equal(state.hasBackendCourses, false);
});

test('returns list mode when backend courses are available', () => {
  const state = resolveFeaturedCoursesState({
    backendCourses: [sampleCourse],
    isLoading: false,
    error: null,
  });

  assert.equal(state.mode, 'list');
  assert.equal(state.showSkeletons, false);
  assert.equal(state.courses.length, 1);
  assert.equal(state.courses[0].id, sampleCourse.id);
  assert.equal(state.hasBackendCourses, true);
});

test('keeps list mode when loading refresh starts with cached backend courses', () => {
  const state = resolveFeaturedCoursesState({
    backendCourses: [sampleCourse],
    isLoading: true,
    error: null,
  });

  assert.equal(state.mode, 'list');
  assert.equal(state.showSkeletons, false);
  assert.equal(state.courses.length, 1);
  assert.equal(state.hasBackendCourses, true);
});

test('returns empty mode when loading completes and backend returns no courses', () => {
  const state = resolveFeaturedCoursesState({
    backendCourses: [],
    isLoading: false,
    error: null,
  });

  assert.equal(state.mode, 'empty');
  assert.equal(state.showSkeletons, false);
  assert.equal(state.courses.length, 0);
  assert.equal(state.hasBackendCourses, false);
});

test('returns unavailable mode on backend error and never returns fabricated fallback courses', () => {
  const state = resolveFeaturedCoursesState({
    backendCourses: [sampleCourse],
    isLoading: false,
    error: new Error('request failed'),
  });

  assert.equal(state.mode, 'unavailable');
  assert.equal(state.showSkeletons, false);
  assert.equal(state.courses.length, 0);
});

test('buildFeaturedCoursesFallbackLog returns explicit no-fallback metadata', () => {
  assert.deepEqual(buildFeaturedCoursesFallbackLog(), {
    endpoint: '/api/v1/courses',
    reason: 'request_failed',
    fallbackCount: 0,
  });
});
