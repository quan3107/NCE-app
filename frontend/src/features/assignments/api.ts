/**
 * Location: features/assignments/api.ts
 * Purpose: Expose assignment-centric data fetchers and hooks backed by React Query.
 * Why: Aligns assignment data access with the live API while keeping UI types stable.
 */

import { useMemo } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';

import { useAuth } from '@lib/auth';
import type { Enrollment } from '@domain';
import { queryClient } from '@lib/queryClient';
import { useCoursesQuery } from '@features/courses/api';
import { toAssignment, toSubmission } from './api.mappers';
import {
  createAssignment,
  createSubmission,
  fetchAssignments,
  fetchEnrollments,
  fetchSubmissions,
  updateAssignment,
} from './api.requests';
import type {
  ApiSubmission,
  CreateAssignmentRequest,
  CreateSubmissionRequest,
  UpdateAssignmentRequest,
} from './api.types';
import { ASSIGNMENTS_KEY, ENROLLMENTS_KEY, SUBMISSIONS_KEY } from './api.types';

function useAssignmentsQuery(courseIds: string[], enabled: boolean) {
  return useQuery({
    queryKey: [ASSIGNMENTS_KEY, ...courseIds],
    queryFn: () => fetchAssignments(courseIds),
    enabled: enabled && courseIds.length > 0,
  });
}

function useSubmissionsQuery(assignmentIds: string[], enabled: boolean) {
  return useQuery({
    queryKey: [SUBMISSIONS_KEY, ...assignmentIds],
    queryFn: () => fetchSubmissions(assignmentIds),
    enabled: enabled && assignmentIds.length > 0,
  });
}

function useEnrollmentsQuery(userId: string | undefined) {
  return useQuery({
    queryKey: [ENROLLMENTS_KEY, userId],
    queryFn: fetchEnrollments,
    enabled: Boolean(userId),
  });
}

export function useCreateAssignmentMutation() {
  return useMutation({
    mutationFn: ({ courseId, payload }: { courseId: string; payload: CreateAssignmentRequest }) =>
      createAssignment(courseId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ASSIGNMENTS_KEY] });
    },
  });
}

export function useUpdateAssignmentMutation() {
  return useMutation({
    mutationFn: ({
      courseId,
      assignmentId,
      payload,
    }: {
      courseId: string;
      assignmentId: string;
      payload: UpdateAssignmentRequest;
    }) => updateAssignment(courseId, assignmentId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ASSIGNMENTS_KEY] });
    },
  });
}

export function useCreateSubmissionMutation() {
  return useMutation({
    mutationFn: ({
      assignmentId,
      payload,
    }: {
      assignmentId: string;
      payload: CreateSubmissionRequest;
    }) => createSubmission(assignmentId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SUBMISSIONS_KEY] });
    },
  });
}

export function markSubmissionAsGraded(submissionId: string) {
  queryClient.setQueriesData<ApiSubmission[]>(
    { queryKey: [SUBMISSIONS_KEY], exact: false },
    (data) => {
      if (!data) {
        return data;
      }
      return data.map((submission) =>
        submission.id === submissionId
          ? { ...submission, status: 'graded' }
          : submission,
      );
    },
  );
}

export function useAssignmentResources() {
  const { currentUser } = useAuth();
  const coursesQuery = useCoursesQuery();

  const courseMap = useMemo(() => {
    const courses = coursesQuery.data ?? [];
    return new Map(courses.map(course => [course.id, course.title]));
  }, [coursesQuery.data]);

  const courseIds = useMemo(
    () => (coursesQuery.data ? coursesQuery.data.map(course => course.id) : []),
    [coursesQuery.data],
  );

  const isAuthenticated = currentUser.role !== 'public' && currentUser.id.length > 0;
  const assignmentsQuery = useAssignmentsQuery(courseIds, isAuthenticated);
  const assignments = useMemo(() => {
    const data = assignmentsQuery.data ?? [];
    return data.map(assignment =>
      toAssignment(assignment, courseMap.get(assignment.courseId) ?? 'Unknown Course'),
    );
  }, [assignmentsQuery.data, courseMap]);

  const assignmentIds = useMemo(
    () => (assignmentsQuery.data ? assignmentsQuery.data.map(item => item.id) : []),
    [assignmentsQuery.data],
  );

  // Submissions list supports students (scoped to their own submissions) and staff.
  const canViewSubmissions =
    currentUser.role === 'admin' ||
    currentUser.role === 'teacher' ||
    currentUser.role === 'student';
  const submissionsQuery = useSubmissionsQuery(assignmentIds, canViewSubmissions);
  const submissions = useMemo(
    () => (submissionsQuery.data ?? []).map(toSubmission),
    [submissionsQuery.data],
  );

  const enrollmentsQuery = useEnrollmentsQuery(currentUser.id || undefined);
  const enrollments = useMemo(() => {
    const data = enrollmentsQuery.data;
    if (!data) {
      return [] as Enrollment[];
    }

    return data.enrollments.map(enrollment => ({
      id: enrollment.id,
      userId: data.profile.id,
      courseId: enrollment.courseId,
      enrolledAt: new Date(enrollment.enrolledAt),
    }));
  }, [enrollmentsQuery.data]);

  const isLoading =
    coursesQuery.isLoading ||
    assignmentsQuery.isLoading ||
    submissionsQuery.isLoading ||
    enrollmentsQuery.isLoading;
  const error =
    coursesQuery.error ??
    assignmentsQuery.error ??
    submissionsQuery.error ??
    enrollmentsQuery.error ??
    null;

  return useMemo(
    () => ({
      assignments,
      submissions,
      enrollments,
      courses: coursesQuery.data ?? [],
      isLoading,
      error,
      refetch: async () => {
        await Promise.all([
          coursesQuery.refetch(),
          assignmentsQuery.refetch(),
          submissionsQuery.refetch(),
          enrollmentsQuery.refetch(),
        ]);
      },
    }),
    [
      assignments,
      submissions,
      enrollments,
      coursesQuery.data,
      coursesQuery.refetch,
      assignmentsQuery.refetch,
      submissionsQuery.refetch,
      enrollmentsQuery.refetch,
      isLoading,
      error,
    ],
  );
}
