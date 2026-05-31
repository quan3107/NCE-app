/**
 * Location: features/courses/management/api.ts
 * Purpose: Wrap backend course management endpoints with typed helpers.
 * Why: Centralizes API access for the management feature while we migrate off mocks.
 */

import { useQuery } from '@tanstack/react-query';

import { apiClient } from '@lib/apiClient';
import type { AssignmentType, UserStatus } from '@lib/backend-schema';
import { queryClient } from '@lib/queryClient';

export type CourseMetricsResponse = {
  activeStudentCount: number;
  invitedStudentCount: number;
  teacherCount: number;
  assignmentCount: number;
  rubricCount: number;
  completionRatePercent: number;
};

export type CourseScheduleResponse = {
  cadence: string | null;
  startTime: string | null;
  durationMinutes: number | null;
  timeZone: string | null;
  format: string | null;
  label: string | null;
} | null;

export type CourseMetadataResponse = {
  duration: string | null;
  level: string | null;
  price: number | null;
};

export type CourseOwnerResponse = {
  id: string;
  fullName: string;
  email: string;
};

export type CourseDetailResponse = {
  id: string;
  title: string;
  description: string | null;
  schedule: CourseScheduleResponse;
  metadata: CourseMetadataResponse;
  owner: CourseOwnerResponse;
  metrics: CourseMetricsResponse;
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CourseStudentResponse = {
  id: string;
  fullName: string;
  email: string;
  status: UserStatus;
  enrolledAt: string;
};

export type CourseStudentsResponse = {
  courseId: string;
  students: CourseStudentResponse[];
};

export type CourseAssignmentResponse = {
  id: string;
  courseId: string;
  title: string;
  description: string | null;
  type: AssignmentType;
  dueAt: string | null;
  latePolicy: Record<string, unknown> | string | null;
  publishedAt: string | null;
  assignmentConfig?: Record<string, unknown> | string | null;
};

export const courseDetailKey = (courseId: string) => ['courses', 'detail', courseId] as const;
export const courseStudentsKey = (courseId: string) =>
  ['courses', courseId, 'students'] as const;
export const courseAssignmentsKey = (courseId: string) =>
  ['courses', courseId, 'assignments'] as const;

export const fetchCourseDetail = (courseId: string): Promise<CourseDetailResponse> =>
  apiClient<CourseDetailResponse>(`/api/v1/courses/${courseId}`);

export const fetchCourseStudents = (courseId: string): Promise<CourseStudentsResponse> =>
  apiClient<CourseStudentsResponse>(`/api/v1/courses/${courseId}/students`);

export const fetchCourseAssignments = (courseId: string): Promise<CourseAssignmentResponse[]> =>
  apiClient<CourseAssignmentResponse[]>(`/api/v1/courses/${courseId}/assignments`);

export type CourseMutationResponse = {
  id: string;
  title: string;
  description: string | null;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type UpdateCourseDetailsPayload = {
  title: string;
  description: string;
  schedule: string;
  duration: string;
  level: string;
  price: string;
};

type UpdateCourseRequest = {
  title: string;
  description: string | null;
  schedule: {
    label: string | null;
    duration: string | null;
    level: string | null;
    price: number | null;
  };
};

const nullableText = (value: string): string | null => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const nullablePrice = (value: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
};

const invalidateCourseCaches = async (courseId: string) => {
  await queryClient.invalidateQueries({
    predicate: (query) => {
      const [scope, maybeCourseId] = query.queryKey;
      return scope === 'courses' && (maybeCourseId === courseId || maybeCourseId !== undefined);
    },
  });
  await queryClient.invalidateQueries({ queryKey: ['courses', 'list'] });
};

export const updateCourseDetails = async (
  courseId: string,
  payload: UpdateCourseDetailsPayload,
): Promise<CourseMutationResponse> => {
  const response = await apiClient<CourseMutationResponse, UpdateCourseRequest>(
    `/api/v1/courses/${courseId}`,
    {
      method: 'PATCH',
      body: {
        title: payload.title.trim(),
        description: nullableText(payload.description),
        schedule: {
          label: nullableText(payload.schedule),
          duration: nullableText(payload.duration),
          level: nullableText(payload.level),
          price: nullablePrice(payload.price),
        },
      },
    },
  );

  await invalidateCourseCaches(courseId);
  return response;
};

export const removeCourseStudent = async (
  courseId: string,
  studentId: string,
): Promise<void> => {
  await apiClient<void>(`/api/v1/courses/${courseId}/students/${studentId}`, {
    method: 'DELETE',
    parseJson: false,
  });

  queryClient.setQueryData<CourseStudentsResponse>(courseStudentsKey(courseId), (existing) => {
    if (!existing) {
      return existing;
    }

    return {
      courseId: existing.courseId,
      students: existing.students.filter((student) => student.id !== studentId),
    };
  });
  await invalidateCourseCaches(courseId);
};

export const archiveCourse = async (courseId: string): Promise<CourseMutationResponse> => {
  const response = await apiClient<CourseMutationResponse>(`/api/v1/courses/${courseId}/archive`, {
    method: 'POST',
  });
  await invalidateCourseCaches(courseId);
  return response;
};

export const restoreCourse = async (courseId: string): Promise<CourseMutationResponse> => {
  const response = await apiClient<CourseMutationResponse>(`/api/v1/courses/${courseId}/restore`, {
    method: 'POST',
  });
  await invalidateCourseCaches(courseId);
  return response;
};

export type AddCourseStudentPayload = {
  email: string;
};

export const addCourseStudent = async (
  courseId: string,
  payload: AddCourseStudentPayload,
): Promise<CourseStudentResponse> => {
  const student = await apiClient<CourseStudentResponse, AddCourseStudentPayload>(
    `/api/v1/courses/${courseId}/students`,
    {
      method: 'POST',
      body: payload,
    },
  );

  // Keep the cached roster in sync without forcing a full refetch.
  const cacheKey = courseStudentsKey(courseId);
  const existing = queryClient.getQueryData<CourseStudentsResponse>(cacheKey);
  const nextStudents = existing
    ? existing.students.filter((item) => item.id !== student.id).concat(student)
    : [student];

  queryClient.setQueryData<CourseStudentsResponse>(cacheKey, {
    courseId,
    students: nextStudents.sort(
      (a, b) =>
        new Date(a.enrolledAt).getTime() - new Date(b.enrolledAt).getTime(),
    ),
  });
  await invalidateCourseCaches(courseId);

  return student;
};

export function useCourseDetailQuery(courseId: string) {
  return useQuery({
    queryKey: courseDetailKey(courseId),
    queryFn: () => fetchCourseDetail(courseId),
  });
}

export function useCourseStudentsQuery(courseId: string) {
  return useQuery({
    queryKey: courseStudentsKey(courseId),
    queryFn: () => fetchCourseStudents(courseId),
  });
}

export function useCourseAssignmentsQuery(courseId: string) {
  return useQuery({
    queryKey: courseAssignmentsKey(courseId),
    queryFn: () => fetchCourseAssignments(courseId),
    enabled: Boolean(courseId),
  });
}
