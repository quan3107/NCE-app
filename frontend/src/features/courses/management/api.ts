/**
 * Location: features/courses/management/api.ts
 * Purpose: Wrap backend course management endpoints with typed helpers.
 * Why: Centralizes API access for the management feature while we migrate off mocks.
 */

import { useQuery } from '@tanstack/react-query';

import { apiClient } from '@lib/apiClient';
import { queryClient } from '@lib/queryClient';

export type CourseMetricsResponse = {
  activeStudentCount: number;
  invitedStudentCount: number;
  teacherCount: number;
  assignmentCount: number;
  rubricCount: number;
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
  createdAt: string;
  updatedAt: string;
};

export type CourseStudentResponse = {
  id: string;
  fullName: string;
  email: string;
  status: 'active' | 'invited' | 'suspended';
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
  type:
    | 'file'
    | 'link'
    | 'text'
    | 'quiz'
    | 'reading'
    | 'listening'
    | 'writing'
    | 'speaking';
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
