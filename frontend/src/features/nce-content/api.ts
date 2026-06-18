/**
 * Location: features/nce-content/api.ts
 * Purpose: Expose read-only NCE content fetchers and query hooks.
 * Why: Gives student and teacher views a typed path to published and authorized draft content.
 */

import { useMutation, useQuery } from '@tanstack/react-query';

import { apiClient, type ApiClientOptions } from '@lib/apiClient';
import { queryClient } from '@lib/queryClient';
import type {
  CourseNceLessonAssignmentPayload,
  CourseNceLessonAssignmentResponse,
  CourseNceLessonListResponse,
  NceBookListResponse,
  NceLesson,
  NceLessonPatchPayload,
  NceLessonListResponse,
  NceLessonWritePayload,
  NceReadQuery,
  NceUnitListResponse,
} from './types';

export const NCE_CONTENT_KEY = ['nce-content'] as const;

type PublicNceReadQuery =
  | { includeDrafts?: false; courseId?: never }
  | { includeDrafts: true; courseId: string };

type PublicNcePaginatedReadQuery = PublicNceReadQuery &
  Pick<NceReadQuery, 'page' | 'pageSize'>;

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
  query: PublicNceReadQuery = {},
) =>
  apiClient<NceBookListResponse>('/nce/books', {
    params: queryParams(query),
    withAuth: shouldUseAuth(query),
  });

export const fetchNceUnits = (
  bookId: string,
  query: PublicNceReadQuery = {},
) =>
  apiClient<NceUnitListResponse>(`/nce/books/${bookId}/units`, {
    params: queryParams(query),
    withAuth: shouldUseAuth(query),
  });

export const fetchNceLessons = (
  unitId: string,
  query: PublicNcePaginatedReadQuery = {},
) =>
  apiClient<NceLessonListResponse>(`/nce/units/${unitId}/lessons`, {
    params: queryParams(query),
    withAuth: shouldUseAuth(query),
  });

export const fetchNceLesson = (
  lessonId: string,
  query: PublicNceReadQuery = {},
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

const invalidateNceContent = async () => {
  await queryClient.invalidateQueries({ queryKey: NCE_CONTENT_KEY });
};

export const createNceLesson = async (
  payload: NceLessonWritePayload,
  courseId?: string,
) => {
  const lesson = await apiClient<NceLesson, NceLessonWritePayload>('/nce/lessons', {
    method: 'POST',
    body: payload,
    params: courseId ? { courseId } : undefined,
  });

  await invalidateNceContent();
  return lesson;
};

export const patchNceLesson = async (
  lessonId: string,
  payload: NceLessonPatchPayload,
  courseId?: string,
) => {
  const lesson = await apiClient<NceLesson, NceLessonPatchPayload>(
    `/nce/lessons/${lessonId}`,
    {
      method: 'PATCH',
      body: payload,
      params: courseId ? { courseId } : undefined,
    },
  );

  await invalidateNceContent();
  return lesson;
};

export const publishNceLesson = async (lessonId: string, courseId?: string) => {
  const lesson = await apiClient<NceLesson>(`/nce/lessons/${lessonId}/publish`, {
    method: 'POST',
    params: courseId ? { courseId } : undefined,
  });

  await invalidateNceContent();
  return lesson;
};

export const unpublishNceLesson = async (lessonId: string, courseId?: string) => {
  const lesson = await apiClient<NceLesson>(`/nce/lessons/${lessonId}/unpublish`, {
    method: 'POST',
    params: courseId ? { courseId } : undefined,
  });

  await invalidateNceContent();
  return lesson;
};

export const assignCourseNceLessons = async (
  courseId: string,
  payload: CourseNceLessonAssignmentPayload,
) => {
  const response = await apiClient<
    CourseNceLessonAssignmentResponse,
    CourseNceLessonAssignmentPayload
  >(`/courses/${courseId}/nce-lessons`, {
    method: 'PUT',
    body: payload,
  });

  await invalidateNceContent();
  return response;
};

export function useNceBooksQuery(
  query: PublicNceReadQuery = {},
) {
  return useQuery({
    queryKey: [...NCE_CONTENT_KEY, 'books', query],
    queryFn: () => fetchNceBooks(query),
  });
}

export function useNceUnitsQuery(
  bookId: string | undefined,
  query: PublicNceReadQuery = {},
) {
  return useQuery({
    queryKey: [...NCE_CONTENT_KEY, 'books', bookId, 'units', query],
    queryFn: () => fetchNceUnits(bookId ?? '', query),
    enabled: Boolean(bookId),
  });
}

export function useNceLessonsQuery(
  unitId: string | undefined,
  query: PublicNcePaginatedReadQuery = {},
) {
  return useQuery({
    queryKey: [...NCE_CONTENT_KEY, 'units', unitId, 'lessons', query],
    queryFn: () => fetchNceLessons(unitId ?? '', query),
    enabled: Boolean(unitId),
  });
}

export function useNceLessonQuery(
  lessonId: string | undefined,
  query: PublicNceReadQuery = {},
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

export function useCreateNceLessonMutation() {
  return useMutation({
    mutationFn: ({
      payload,
      courseId,
    }: {
      payload: NceLessonWritePayload;
      courseId?: string;
    }) => createNceLesson(payload, courseId),
  });
}

export function usePatchNceLessonMutation() {
  return useMutation({
    mutationFn: ({
      lessonId,
      payload,
      courseId,
    }: {
      lessonId: string;
      payload: NceLessonPatchPayload;
      courseId?: string;
    }) => patchNceLesson(lessonId, payload, courseId),
  });
}

export function usePublishNceLessonMutation() {
  return useMutation({
    mutationFn: ({
      lessonId,
      courseId,
    }: {
      lessonId: string;
      courseId?: string;
    }) => publishNceLesson(lessonId, courseId),
  });
}

export function useUnpublishNceLessonMutation() {
  return useMutation({
    mutationFn: ({
      lessonId,
      courseId,
    }: {
      lessonId: string;
      courseId?: string;
    }) => unpublishNceLesson(lessonId, courseId),
  });
}
