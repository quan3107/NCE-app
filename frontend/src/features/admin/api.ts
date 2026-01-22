/**
 * Location: features/admin/api.ts
 * Purpose: Provide admin-specific data queries derived from the live API.
 * Why: Enables admin views to share a single source of truth via React Query.
 */

import { useMemo } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';

import { apiClient } from '@lib/apiClient';
import { AuditLog, Enrollment, User } from '@lib/mock-data';
import { queryClient } from '@lib/queryClient';
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

type ApiAuditActor = {
  id: string;
  fullName: string;
};

type ApiAuditLog = {
  id: string;
  actorId?: string | null;
  actor?: ApiAuditActor | null;
  action: string;
  entity: string;
  entityId: string;
  diff?: Record<string, unknown> | null;
  createdAt: string;
};

type ApiAuditLogPage = {
  data: ApiAuditLog[];
  nextCursor?: string | null;
};

type CreateUserRequest = {
  email: string;
  fullName: string;
  role: User['role'];
  status: 'active' | 'invited' | 'suspended';
};

type CreateEnrollmentRequest = {
  courseId: string;
  userId: string;
  roleInCourse: 'student' | 'teacher';
};

type CreateCourseRequest = {
  title: string;
  description?: string;
  ownerTeacherId: string;
  schedule?: Record<string, unknown>;
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

const toAuditLog = (log: ApiAuditLog): AuditLog => {
  const diff = log.diff ?? null;
  const details = diff ? JSON.stringify(diff) : `Entity ID: ${log.entityId}`;

  return {
    id: log.id,
    actor: log.actor?.fullName ?? 'System',
    action: log.action,
    entity: log.entity,
    timestamp: new Date(log.createdAt),
    details,
  };
};

const fetchUsers = async (): Promise<User[]> => {
  const response = await apiClient<ApiUser[]>('/api/v1/users');
  return response.map(toUser);
};

const fetchEnrollments = async (): Promise<Enrollment[]> => {
  const response = await apiClient<ApiEnrollment[]>('/api/v1/enrollments');
  return response.map(toEnrollment);
};

const fetchAuditLogs = async (): Promise<AuditLog[]> => {
  const response = await apiClient<ApiAuditLogPage>('/api/v1/audit-logs');
  return response.data.map(toAuditLog);
};

const createUser = async (payload: CreateUserRequest): Promise<ApiUser> => {
  return apiClient<ApiUser, CreateUserRequest>('/api/v1/users', {
    method: 'POST',
    body: payload,
  });
};

const createEnrollment = async (
  payload: CreateEnrollmentRequest,
): Promise<ApiEnrollment> => {
  return apiClient<ApiEnrollment, CreateEnrollmentRequest>('/api/v1/enrollments', {
    method: 'POST',
    body: payload,
  });
};

const removeEnrollment = async (
  courseId: string,
  studentId: string,
): Promise<void> => {
  await apiClient<void>(`/api/v1/courses/${courseId}/students/${studentId}`, {
    method: 'DELETE',
  });
};

const createCourse = async (payload: CreateCourseRequest): Promise<void> => {
  await apiClient('/api/v1/courses', {
    method: 'POST',
    body: payload,
  });
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

export function useCreateUserMutation() {
  return useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADMIN_USERS_KEY });
    },
  });
}

export function useCreateEnrollmentMutation() {
  return useMutation({
    mutationFn: createEnrollment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADMIN_ENROLLMENTS_KEY });
    },
  });
}

export function useRemoveEnrollmentMutation() {
  return useMutation({
    mutationFn: ({ courseId, studentId }: { courseId: string; studentId: string }) =>
      removeEnrollment(courseId, studentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADMIN_ENROLLMENTS_KEY });
    },
  });
}

export function useCreateCourseMutation() {
  return useMutation({
    mutationFn: createCourse,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courses'] });
    },
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
