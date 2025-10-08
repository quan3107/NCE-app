/**
 * Location: features/admin/api.ts
 * Purpose: Provide admin-specific data queries derived from the shared mock dataset.
 * Why: Enables admin views to share a single source of truth before backend wiring.
 */

import { useMemo } from 'react';
import {
  AuditLog,
  Enrollment,
  User,
  mockAuditLogs,
  mockEnrollments,
  mockUsers,
} from '@lib/mock-data';
import { queryClient } from '@lib/queryClient';
import { useStaticQuery } from '@lib/useStaticQuery';
import { useAssignmentResources } from '@features/assignments/api';
import { useCoursesQuery } from '@features/courses/api';

const ADMIN_USERS_KEY = 'admin:users';
const ADMIN_ENROLLMENTS_KEY = 'admin:enrollments';
const ADMIN_AUDIT_LOGS_KEY = 'admin:auditLogs';

const fetchUsers = async (): Promise<User[]> => mockUsers;
const fetchEnrollments = async (): Promise<Enrollment[]> => mockEnrollments;
const fetchAuditLogs = async (): Promise<AuditLog[]> => mockAuditLogs;

export function preloadAdminData() {
  queryClient.setQueryData(ADMIN_USERS_KEY, mockUsers);
  queryClient.setQueryData(ADMIN_ENROLLMENTS_KEY, mockEnrollments);
  queryClient.setQueryData(ADMIN_AUDIT_LOGS_KEY, mockAuditLogs);
}

export function useAdminUsersQuery() {
  return useStaticQuery<User[]>(ADMIN_USERS_KEY, fetchUsers);
}

export function useAdminEnrollmentsQuery() {
  return useStaticQuery<Enrollment[]>(ADMIN_ENROLLMENTS_KEY, fetchEnrollments);
}

export function useAdminAuditLogsQuery() {
  return useStaticQuery<AuditLog[]>(ADMIN_AUDIT_LOGS_KEY, fetchAuditLogs);
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
    refresh: async () => {
      await Promise.all([
        assignments.refresh(),
        courses.refresh(),
        users.refresh(),
        enrollments.refresh(),
      ]);
    },
  };
}


