/**
 * Location: features/admin/api.ts
 * Purpose: Provide admin-specific data queries derived from the live API.
 * Why: Enables admin views to share a single source of truth via React Query.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { apiClient } from '@lib/apiClient';
import { AuditLog, Enrollment, User } from '@lib/mock-data';
import { useAssignmentResources } from '@features/assignments/api';
import { useCoursesQuery } from '@features/courses/api';

const ADMIN_USERS_KEY = ['admin', 'users'] as const;
const ADMIN_ENROLLMENTS_KEY = ['admin', 'enrollments'] as const;
const ADMIN_AUDIT_LOGS_KEY = ['admin', 'auditLogs'] as const;

type ApiUser = {
  id: string;
  email: string;
  fullName: string;
  role: User['role'];
  status: string;
};

type ApiEnrollment = {
  id: string;
  courseId: string;
  userId: string;
  createdAt: string;
};

const toUser = (user: ApiUser): User => ({
  id: user.id,
  name: user.fullName,
  email: user.email,
  role: user.role,
});

const toEnrollment = (enrollment: ApiEnrollment): Enrollment => ({
  id: enrollment.id,
  userId: enrollment.userId,
  courseId: enrollment.courseId,
  enrolledAt: new Date(enrollment.createdAt),
});

const fetchUsers = async (): Promise<User[]> => {
  const response = await apiClient<ApiUser[]>('/api/v1/users');
  return response.map(toUser);
};

const fetchEnrollments = async (): Promise<Enrollment[]> => {
  const response = await apiClient<ApiEnrollment[]>('/api/v1/enrollments');
  return response.map(toEnrollment);
};

// Audit log endpoints are not exposed yet; return empty data until the API is available.
const fetchAuditLogs = async (): Promise<AuditLog[]> => {
  return [];
};

export function useAdminUsersQuery() {
  return useQuery({
    queryKey: ADMIN_USERS_KEY,
    queryFn: fetchUsers,
  });
}

export function useAdminEnrollmentsQuery() {
  return useQuery({
    queryKey: ADMIN_ENROLLMENTS_KEY,
    queryFn: fetchEnrollments,
  });
}

export function useAdminAuditLogsQuery() {
  return useQuery({
    queryKey: ADMIN_AUDIT_LOGS_KEY,
    queryFn: fetchAuditLogs,
  });
}

export function useAdminDashboardMetrics() {
  const assignments = useAssignmentResources();
  const courses = useCoursesQuery();
  const users = useAdminUsersQuery();
  const enrollments = useAdminEnrollmentsQuery();

  const isLoading =
    assignments.isLoading || courses.isLoading || users.isLoading || enrollments.isLoading;
  const error = assignments.error ?? courses.error ?? users.error ?? enrollments.error ?? null;

  const userCount = users.data?.length ?? 0;
  const courseCount = courses.data?.length ?? 0;
  const enrollmentCount = enrollments.data?.length ?? 0;
  const assignmentCount = assignments.assignments.length;

  const metrics = useMemo(
    () => ({
      users: userCount,
      courses: courseCount,
      enrollments: enrollmentCount,
      assignments: assignmentCount,
    }),
    [userCount, courseCount, enrollmentCount, assignmentCount],
  );

  return {
    metrics,
    isLoading,
    error,
    refetch: async () => {
      await Promise.all([
        assignments.refetch(),
        courses.refetch(),
        users.refetch(),
        enrollments.refetch(),
      ]);
    },
  };
}
