/**
 * Location: features/courses/api.ts
 * Purpose: Centralize course data fetching so routes/components can share cached results.
 * Why: Simplifies the future transition from mock data to real API endpoints.
 */

import { Course, mockCourses } from '@lib/mock-data';
import { queryClient } from '@lib/queryClient';
import { useStaticQuery } from '@lib/useStaticQuery';

const COURSES_KEY = 'courses:list';

const fetchCourses = async (): Promise<Course[]> => mockCourses;

export function preloadCourses() {
  queryClient.setQueryData(COURSES_KEY, mockCourses);
}

export function useCoursesQuery() {
  return useStaticQuery<Course[]>(COURSES_KEY, fetchCourses);
}
