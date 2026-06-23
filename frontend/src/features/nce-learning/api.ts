/**
 * Location: features/nce-learning/api.ts
 * Purpose: Expose student NCE path, attempt, submit, and completion helpers.
 * Why: Gives NCE learning components a typed path to the backend workflow.
 */

import { useMutation, useQuery } from '@tanstack/react-query';

import { apiClient, type ApiClientOptions } from '@lib/apiClient';
import { queryClient } from '@lib/queryClient';
import type {
  NceAttempt,
  NceAttemptDraftPayload,
  NceAttemptResponse,
  NceLessonProgress,
  StudentNcePathQuery,
  StudentNcePathResponse,
} from './types';

export const NCE_LEARNING_KEY = ['nce-learning'] as const;

const queryParams = (
  query: StudentNcePathQuery = {},
): NonNullable<ApiClientOptions['params']> => ({
  page: query.page,
  pageSize: query.pageSize,
});

const invalidateNceLearning = async () => {
  await queryClient.invalidateQueries({ queryKey: NCE_LEARNING_KEY });
};

export const fetchStudentNcePath = (
  courseId: string,
  query: StudentNcePathQuery = {},
) =>
  apiClient<StudentNcePathResponse>(`/courses/${courseId}/nce-path`, {
    params: queryParams(query),
  });

export const saveNceAttemptDraft = async (
  courseId: string,
  exerciseId: string,
  response: NceAttemptResponse,
) => {
  const attempt = await apiClient<NceAttempt, NceAttemptDraftPayload>(
    `/courses/${courseId}/nce-exercises/${exerciseId}/attempts`,
    {
      method: 'POST',
      body: { response },
    },
  );

  await invalidateNceLearning();
  return attempt;
};

export const submitNceAttempt = async (attemptId: string) => {
  const attempt = await apiClient<NceAttempt>(`/nce-attempts/${attemptId}/submit`, {
    method: 'POST',
  });

  await invalidateNceLearning();
  return attempt;
};

export const completeNceLesson = async (courseId: string, lessonId: string) => {
  const progress = await apiClient<NceLessonProgress>(
    `/courses/${courseId}/nce-lessons/${lessonId}/complete`,
    {
      method: 'POST',
    },
  );

  await invalidateNceLearning();
  return progress;
};

export function useStudentNcePathQuery(
  courseId: string | undefined,
  query: StudentNcePathQuery = {},
) {
  return useQuery({
    queryKey: [...NCE_LEARNING_KEY, 'courses', courseId, 'path', query],
    queryFn: () => fetchStudentNcePath(courseId ?? '', query),
    enabled: Boolean(courseId),
  });
}

export function useSaveNceAttemptDraftMutation() {
  return useMutation({
    mutationFn: ({
      courseId,
      exerciseId,
      response,
    }: {
      courseId: string;
      exerciseId: string;
      response: NceAttemptResponse;
    }) => saveNceAttemptDraft(courseId, exerciseId, response),
  });
}

export function useSubmitNceAttemptMutation() {
  return useMutation({
    mutationFn: (attemptId: string) => submitNceAttempt(attemptId),
  });
}

export function useCompleteNceLessonMutation() {
  return useMutation({
    mutationFn: ({ courseId, lessonId }: { courseId: string; lessonId: string }) =>
      completeNceLesson(courseId, lessonId),
  });
}
