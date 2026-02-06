/**
 * Location: features/rubrics/api.ts
 * Purpose: Provide rubric and rubric-template data hooks for teacher/admin workflows.
 * Why: Keeps rubric contracts centralized so pages can remove hardcoded defaults safely.
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

export type RubricTemplateContext = 'course' | 'assignment' | 'grading';
export type RubricTemplateAssignmentType =
  | 'reading'
  | 'listening'
  | 'writing'
  | 'speaking'
  | 'generic';

export type RubricTemplateLevel = {
  label: string;
  points: number;
  desc?: string;
};

export type RubricTemplateCriterion = {
  id: string;
  name: string;
  weight: number;
  description?: string;
  maxScore?: number;
  levels?: RubricTemplateLevel[];
};

export type RubricTemplate = {
  id: string;
  name: string;
  context: RubricTemplateContext;
  assignmentType: RubricTemplateAssignmentType;
  source: 'system' | 'course';
  criteria: RubricTemplateCriterion[];
};

export type RubricTemplatesResponse = {
  templates: RubricTemplate[];
};

export type CourseDefaultRubricTemplateResponse = {
  template: RubricTemplate;
};

const rubricsKey = (courseId: string) => ['rubrics', 'course', courseId] as const;
const defaultRubricsKey = (
  context: RubricTemplateContext,
  assignmentType?: RubricTemplateAssignmentType,
) => ['rubrics', 'defaults', context, assignmentType ?? 'all'] as const;
const courseDefaultRubricKey = (courseId: string) =>
  ['rubrics', 'course', courseId, 'default-template'] as const;
const rubricTemplatesKey = (
  courseId: string,
  context?: RubricTemplateContext,
) => ['rubrics', 'templates', courseId, context ?? 'all'] as const;

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

const fetchDefaultRubrics = async (
  context: RubricTemplateContext,
  assignmentType?: RubricTemplateAssignmentType,
): Promise<RubricTemplatesResponse> => {
  const params = new URLSearchParams({ context });
  if (assignmentType) {
    params.set('assignmentType', assignmentType);
  }
  return apiClient<RubricTemplatesResponse>(`/api/v1/config/default-rubrics?${params.toString()}`);
};

const fetchCourseDefaultRubricTemplate = async (
  courseId: string,
): Promise<CourseDefaultRubricTemplateResponse> => {
  return apiClient<CourseDefaultRubricTemplateResponse>(
    `/api/v1/courses/${courseId}/default-rubric-template`,
  );
};

const fetchRubricTemplates = async (
  courseId: string,
  context?: RubricTemplateContext,
): Promise<RubricTemplatesResponse> => {
  const params = new URLSearchParams({ courseId });
  if (context) {
    params.set('context', context);
  }
  return apiClient<RubricTemplatesResponse>(`/api/v1/rubrics/templates?${params.toString()}`);
};

export function useCourseRubricsQuery(courseId: string) {
  return useQuery({
    queryKey: rubricsKey(courseId),
    queryFn: () => fetchRubrics(courseId),
    enabled: Boolean(courseId),
  });
}

export function useDefaultRubricsQuery(
  context: RubricTemplateContext,
  assignmentType?: RubricTemplateAssignmentType,
) {
  return useQuery({
    queryKey: defaultRubricsKey(context, assignmentType),
    queryFn: () => fetchDefaultRubrics(context, assignmentType),
  });
}

export function useCourseDefaultRubricTemplateQuery(courseId: string) {
  return useQuery({
    queryKey: courseDefaultRubricKey(courseId),
    queryFn: () => fetchCourseDefaultRubricTemplate(courseId),
    enabled: Boolean(courseId),
  });
}

export function useRubricTemplatesQuery(
  courseId: string,
  context?: RubricTemplateContext,
) {
  return useQuery({
    queryKey: rubricTemplatesKey(courseId, context),
    queryFn: () => fetchRubricTemplates(courseId, context),
    enabled: Boolean(courseId),
  });
}

export function useCreateRubricMutation(courseId: string) {
  return useMutation({
    mutationFn: (payload: CreateRubricRequest) => createRubric(courseId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rubricsKey(courseId) });
      queryClient.invalidateQueries({ queryKey: rubricTemplatesKey(courseId) });
      queryClient.invalidateQueries({ queryKey: courseDefaultRubricKey(courseId) });
    },
  });
}
