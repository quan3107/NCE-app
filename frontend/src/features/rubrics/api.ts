/**
 * Location: features/rubrics/api.ts
 * Purpose: Provide rubric data hooks backed by the course-scoped API.
 * Why: Keeps rubric CRUD wiring centralized for teacher/admin screens.
 */

import { useMutation, useQuery } from '@tanstack/react-query';

import { apiClient } from '@lib/apiClient';
import { queryClient } from '@lib/queryClient';

export type RubricLevel = {
  label: string;
  points: number;
  desc: string;
};

export type RubricCriterion = {
  criterion: string;
  weight: number;
  levels: RubricLevel[];
};

export type Rubric = {
  id: string;
  courseId: string;
  name: string;
  criteria: RubricCriterion[];
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
};

export type CreateRubricRequest = {
  name: string;
  criteria: RubricCriterion[];
};

const rubricsKey = (courseId: string) => ['rubrics', 'course', courseId] as const;

const fetchRubrics = async (courseId: string): Promise<Rubric[]> => {
  return apiClient<Rubric[]>(`/api/v1/courses/${courseId}/rubrics`);
};

const createRubric = async (
  courseId: string,
  payload: CreateRubricRequest,
): Promise<Rubric> => {
  return apiClient<Rubric, CreateRubricRequest>(
    `/api/v1/courses/${courseId}/rubrics`,
    {
      method: 'POST',
      body: payload,
    },
  );
};

export function useCourseRubricsQuery(courseId: string) {
  return useQuery({
    queryKey: rubricsKey(courseId),
    queryFn: () => fetchRubrics(courseId),
    enabled: Boolean(courseId),
  });
}

export function useCreateRubricMutation(courseId: string) {
  return useMutation({
    mutationFn: (payload: CreateRubricRequest) => createRubric(courseId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rubricsKey(courseId) });
    },
  });
}
