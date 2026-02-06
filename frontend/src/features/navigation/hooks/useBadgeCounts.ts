/**
 * Location: src/features/navigation/hooks/useBadgeCounts.ts
 * Purpose: Compute role-aware badge counts with short-lived cache fallback.
 * Why: Reduces badge flicker and preserves recent counts through transient API failures.
 */

import { useCallback, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@store/authStore';

import { useUserNotifications } from '@features/notifications/api';

import {
  fetchAssignmentsPendingCount,
  fetchSubmissionsPendingCount,
} from '../api';
import type { BadgeCounts } from '../types';
import { readBadgeCache, writeBadgeCache } from '../utils/cache';

const ASSIGNMENTS_BADGE_QUERY_KEY = 'navigation:badge:assignments';
const SUBMISSIONS_BADGE_QUERY_KEY = 'navigation:badge:submissions';

const EMPTY_BADGES: BadgeCounts = {
  notifications: 0,
  assignments: 0,
  submissions: 0,
};

export function useBadgeCounts() {
  const { currentUser, isAuthenticated } = useAuthStore();

  const role = isAuthenticated && currentUser.role !== 'public' ? currentUser.role : 'public';
  const userId = currentUser.id || 'public';

  const cacheIdentity = useMemo(
    () => ({
      userId,
      role,
    }),
    [role, userId],
  );

  const cachedBadgeCounts = useMemo(
    () => readBadgeCache(cacheIdentity),
    [cacheIdentity],
  );

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

      return cachedBadgeCounts?.assignments ?? 0;
    },
    enabled: isAuthenticated && role === 'student',
    initialData: role === 'student' ? (cachedBadgeCounts?.assignments ?? 0) : 0,
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

      return cachedBadgeCounts?.submissions ?? 0;
    },
    enabled: isAuthenticated && (role === 'teacher' || role === 'admin'),
    initialData:
      role === 'teacher' || role === 'admin'
        ? (cachedBadgeCounts?.submissions ?? 0)
        : 0,
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

  useEffect(() => {
    if (!isAuthenticated || role === 'public') {
      return;
    }

    writeBadgeCache(cacheIdentity, badgeCounts);
  }, [badgeCounts, cacheIdentity, isAuthenticated, role]);

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
