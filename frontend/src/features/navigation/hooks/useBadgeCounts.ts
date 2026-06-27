/**
 * Location: src/features/navigation/hooks/useBadgeCounts.ts
 * Purpose: Compute role-aware badge counts from backend endpoints.
 * Why: Keeps badge counts server-sourced and surfaces count failures directly.
 */

import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Role } from '@domain';
import { useAuthStore } from '@store/authStore';

import { useUserNotifications } from '@features/notifications/api';

import {
  fetchAssignmentsPendingCount,
  fetchSubmissionsPendingCount,
} from '../api';
import type { BadgeCounts } from '../types';

const ASSIGNMENTS_BADGE_QUERY_KEY = 'navigation:badge:assignments';
const SUBMISSIONS_BADGE_QUERY_KEY = 'navigation:badge:submissions';

const EMPTY_BADGES: BadgeCounts = {
  notifications: 0,
  assignments: 0,
  submissions: 0,
};

export function useBadgeCounts() {
  const { currentUser, isAuthenticated } = useAuthStore();

  const role = useMemo<Role>(() => {
    if (!isAuthenticated) {
      return 'public';
    }

    switch (currentUser.role) {
      case 'student':
      case 'teacher':
      case 'admin':
        return currentUser.role;
      default:
        return 'public';
    }
  }, [currentUser.role, isAuthenticated]);
  const userId = currentUser.id || 'public';

  const notificationsQuery = useUserNotifications(
    isAuthenticated && userId.length > 0 ? userId : undefined,
  );

  const notificationCount = useMemo(
    () => notificationsQuery.notifications.filter((notification) => !notification.read).length,
    [notificationsQuery.notifications],
  );

  const assignmentsQuery = useQuery({
    queryKey: [ASSIGNMENTS_BADGE_QUERY_KEY, userId, role],
    queryFn: async () => {
      const result = await fetchAssignmentsPendingCount();
      if (result.ok) {
        return result.count;
      }

      throw new Error(result.error);
    },
    enabled: isAuthenticated && role === 'student',
    staleTime: 60_000,
    retry: 0,
  });

  const submissionsQuery = useQuery({
    queryKey: [SUBMISSIONS_BADGE_QUERY_KEY, userId, role],
    queryFn: async () => {
      const result = await fetchSubmissionsPendingCount();
      if (result.ok) {
        return result.count;
      }

      throw new Error(result.error);
    },
    enabled: isAuthenticated && (role === 'teacher' || role === 'admin'),
    staleTime: 60_000,
    retry: 0,
  });

  const badgeCounts = useMemo<BadgeCounts>(() => {
    if (!isAuthenticated || role === 'public') {
      return EMPTY_BADGES;
    }

    return {
      notifications: notificationCount,
      assignments: role === 'student' ? (assignmentsQuery.data ?? 0) : 0,
      submissions:
        role === 'teacher' || role === 'admin' ? (submissionsQuery.data ?? 0) : 0,
    };
  }, [
    assignmentsQuery.data,
    isAuthenticated,
    notificationCount,
    role,
    submissionsQuery.data,
  ]);

  const error =
    (assignmentsQuery.error instanceof Error && assignmentsQuery.error) ||
    (submissionsQuery.error instanceof Error && submissionsQuery.error) ||
    (notificationsQuery.error instanceof Error && notificationsQuery.error) ||
    null;

  const refetch = useCallback(async () => {
    await Promise.all([
      notificationsQuery.refetch(),
      assignmentsQuery.refetch(),
      submissionsQuery.refetch(),
    ]);
  }, [assignmentsQuery, notificationsQuery, submissionsQuery]);

  return {
    counts: badgeCounts,
    isLoading:
      notificationsQuery.isLoading || assignmentsQuery.isLoading || submissionsQuery.isLoading,
    error,
    refetch,
  };
}
