/**
 * Location: features/nce-content/api.ts
 * Purpose: Expose read-only NCE content fetchers and query hooks.
 * Why: Gives student and teacher views a typed path to published and authorized draft content.
 */

import { useQuery } from '@tanstack/react-query';

import { apiClient, type ApiClientOptions } from '@lib/apiClient';
import type {
  CourseNceLessonListResponse,
  NceBookListResponse,
  NceLesson,
  NceLessonListResponse,
  NceReadQuery,
  NceUnitListResponse,
} from './types';

export const NCE_CONTENT_KEY = ['nce-content'] as const;

const queryParams = (
  query: NceReadQuery = {},
): NonNullable<ApiClientOptions['params']> => ({
  includeDrafts: query.includeDrafts,
  courseId: query.courseId,
  page: query.page,
  pageSize: query.pageSize,
});

const shouldUseAuth = (query: NceReadQuery = {}) =>
  Boolean(query.includeDrafts || query.courseId);

export const fetchNceBooks = (
  query: Pick<NceReadQuery, 'includeDrafts' | 'courseId'> = {},
) =>
  apiClient<NceBookListResponse>('/nce/books', {
    params: queryParams(query),
    withAuth: shouldUseAuth(query),
  });

export const fetchNceUnits = (
  bookId: string,
  query: Pick<NceReadQuery, 'includeDrafts' | 'courseId'> = {},
) =>
  apiClient<NceUnitListResponse>(`/nce/books/${bookId}/units`, {
    params: queryParams(query),
    withAuth: shouldUseAuth(query),
  });

export const fetchNceLessons = (
  unitId: string,
  query: NceReadQuery = {},
) =>
  apiClient<NceLessonListResponse>(`/nce/units/${unitId}/lessons`, {
    params: queryParams(query),
    withAuth: shouldUseAuth(query),
  });

export const fetchNceLesson = (
  lessonId: string,
  query: Pick<NceReadQuery, 'includeDrafts' | 'courseId'> = {},
) =>
  apiClient<NceLesson>(`/nce/lessons/${lessonId}`, {
    params: queryParams(query),
    withAuth: shouldUseAuth(query),
  });

export const fetchCourseNceLessons = (
  courseId: string,
  query: Omit<NceReadQuery, 'courseId'> = {},
) =>
  apiClient<CourseNceLessonListResponse>(`/courses/${courseId}/nce-lessons`, {
    params: queryParams(query),
  });

export function useNceBooksQuery(
  query: Pick<NceReadQuery, 'includeDrafts' | 'courseId'> = {},
) {
  return useQuery({
    queryKey: [...NCE_CONTENT_KEY, 'books', query],
    queryFn: () => fetchNceBooks(query),
  });
}

export function useNceUnitsQuery(
  bookId: string | undefined,
  query: Pick<NceReadQuery, 'includeDrafts' | 'courseId'> = {},
) {
  return useQuery({
    queryKey: [...NCE_CONTENT_KEY, 'books', bookId, 'units', query],
    queryFn: () => fetchNceUnits(bookId ?? '', query),
    enabled: Boolean(bookId),
  });
}

export function useNceLessonsQuery(
  unitId: string | undefined,
  query: NceReadQuery = {},
) {
  return useQuery({
    queryKey: [...NCE_CONTENT_KEY, 'units', unitId, 'lessons', query],
    queryFn: () => fetchNceLessons(unitId ?? '', query),
    enabled: Boolean(unitId),
  });
}

export function useNceLessonQuery(
  lessonId: string | undefined,
  query: Pick<NceReadQuery, 'includeDrafts' | 'courseId'> = {},
) {
  return useQuery({
    queryKey: [...NCE_CONTENT_KEY, 'lessons', lessonId, query],
    queryFn: () => fetchNceLesson(lessonId ?? '', query),
    enabled: Boolean(lessonId),
  });
}

export function useCourseNceLessonsQuery(
  courseId: string | undefined,
  query: Omit<NceReadQuery, 'courseId'> = {},
) {
  return useQuery({
    queryKey: [...NCE_CONTENT_KEY, 'courses', courseId, 'lessons', query],
    queryFn: () => fetchCourseNceLessons(courseId ?? '', query),
    enabled: Boolean(courseId),
  });
}
