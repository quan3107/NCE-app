/**
 * Location: components/marketing/featuredCourses.state.ts
 * Purpose: Centralize FeaturedCourses view-state resolution and fallback log payload shape.
 * Why: Keeps UI behavior deterministic and testable without rendering React components.
 */

import type { Course } from '@domain';

export type FeaturedCoursesViewMode = 'loading' | 'list' | 'empty' | 'unavailable';

export type FeaturedCoursesStateInput = {
  backendCourses: Course[] | undefined;
  isLoading: boolean;
  error: unknown;
};

export type FeaturedCoursesState = {
  mode: FeaturedCoursesViewMode;
  courses: Course[];
  showSkeletons: boolean;
  hasBackendCourses: boolean;
};

export type FeaturedCoursesFallbackLog = {
  endpoint: '/api/v1/courses';
  reason: 'request_failed';
  fallbackCount: 0;
};

export function resolveFeaturedCoursesState({
  backendCourses,
  isLoading,
  error,
}: FeaturedCoursesStateInput): FeaturedCoursesState {
  const hasBackendCourses = Array.isArray(backendCourses) && backendCourses.length > 0;
  const courses = backendCourses ?? [];
  const showSkeletons = isLoading && !hasBackendCourses;

  if (error) {
    return {
      mode: 'unavailable',
      courses: [],
      showSkeletons: false,
      hasBackendCourses,
    };
  }

  if (showSkeletons) {
    return {
      mode: 'loading',
      courses: [],
      showSkeletons: true,
      hasBackendCourses,
    };
  }

  if (courses.length > 0) {
    return {
      mode: 'list',
      courses,
      showSkeletons: false,
      hasBackendCourses,
    };
  }

  return {
    mode: 'empty',
    courses: [],
    showSkeletons: false,
    hasBackendCourses,
  };
}

export function buildFeaturedCoursesFallbackLog(): FeaturedCoursesFallbackLog {
  return {
    endpoint: '/api/v1/courses',
    reason: 'request_failed',
    fallbackCount: 0,
  };
}
