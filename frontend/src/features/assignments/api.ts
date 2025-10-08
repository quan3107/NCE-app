/**
 * Location: features/assignments/api.ts
 * Purpose: Expose assignment-centric data fetchers and hooks backed by QueryClientStub.
 * Why: Creates a single integration point to swap mock data for real API responses later.
 */

import { useMemo } from 'react';
import {
  Assignment,
  Enrollment,
  Submission,
  mockAssignments,
  mockEnrollments,
  mockSubmissions,
} from '@lib/mock-data';
import { queryClient } from '@lib/queryClient';
import { useStaticQuery } from '@lib/useStaticQuery';
import { useCoursesQuery } from '@features/courses/api';

const ASSIGNMENTS_KEY = 'assignments:list';
const SUBMISSIONS_KEY = 'assignments:submissions';
const ENROLLMENTS_KEY = 'assignments:enrollments';

const fetchAssignments = async (): Promise<Assignment[]> => mockAssignments;
const fetchSubmissions = async (): Promise<Submission[]> => mockSubmissions;
const fetchEnrollments = async (): Promise<Enrollment[]> => mockEnrollments;

export function preloadAssignmentsData() {
  queryClient.setQueryData(ASSIGNMENTS_KEY, mockAssignments);
  queryClient.setQueryData(SUBMISSIONS_KEY, mockSubmissions);
  queryClient.setQueryData(ENROLLMENTS_KEY, mockEnrollments);
}

export function useAssignmentsQuery() {
  return useStaticQuery<Assignment[]>(ASSIGNMENTS_KEY, fetchAssignments);
}

export function useSubmissionsQuery() {
  return useStaticQuery<Submission[]>(SUBMISSIONS_KEY, fetchSubmissions);
}

export function useEnrollmentsQuery() {
  return useStaticQuery<Enrollment[]>(ENROLLMENTS_KEY, fetchEnrollments);
}

export function useAssignmentResources() {
  const assignments = useAssignmentsQuery();
  const submissions = useSubmissionsQuery();
  const enrollments = useEnrollmentsQuery();
  const courses = useCoursesQuery();

  const isLoading =
    assignments.isLoading || submissions.isLoading || enrollments.isLoading || courses.isLoading;
  const error =
    assignments.error ?? submissions.error ?? enrollments.error ?? courses.error ?? null;

  return useMemo(
    () => ({
      assignments: assignments.data ?? [],
      submissions: submissions.data ?? [],
      enrollments: enrollments.data ?? [],
      courses: courses.data ?? [],
      isLoading,
      error,
      refresh: async () => {
        await Promise.all([
          assignments.refresh(),
          submissions.refresh(),
          enrollments.refresh(),
          courses.refresh(),
        ]);
      },
    }),
    [
      assignments.data,
      assignments.refresh,
      submissions.data,
      submissions.refresh,
      enrollments.data,
      enrollments.refresh,
      courses.data,
      courses.refresh,
      isLoading,
      error,
    ],
  );
}
