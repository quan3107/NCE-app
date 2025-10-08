/**
 * Location: features/notifications/api.ts
 * Purpose: Centralize notification queries and mutations backed by the query client stub.
 * Why: Keeps UI layers decoupled from mock data while we await real backend endpoints.
 */

import { useMemo } from 'react';
import { Notification, mockNotifications } from '@lib/mock-data';
import { queryClient } from '@lib/queryClient';
import { useStaticQuery } from '@lib/useStaticQuery';

const NOTIFICATIONS_KEY = 'notifications:list';

const fetchNotifications = async (): Promise<Notification[]> => mockNotifications;

export function preloadNotifications() {
  queryClient.setQueryData(NOTIFICATIONS_KEY, mockNotifications);
}

export function useNotificationsQuery() {
  return useStaticQuery<Notification[]>(NOTIFICATIONS_KEY, fetchNotifications);
}

export function markNotificationsRead(params: { userId: string; notificationIds?: string[] }) {
  const existing = queryClient.getQueryData<Notification[]>(NOTIFICATIONS_KEY) ?? [];
  const { userId, notificationIds } = params;

  const updated = existing.map(notification => {
    if (notification.userId !== userId) {
      return notification;
    }

    if (!notificationIds || notificationIds.includes(notification.id)) {
      return { ...notification, read: true };
    }

    return notification;
  });

  queryClient.setQueryData(NOTIFICATIONS_KEY, updated);
}

export function useUserNotifications(userId: string | undefined) {
  const query = useNotificationsQuery();

  const data = useMemo(() => {
    if (!userId) {
      return [] as Notification[];
    }

    return (query.data ?? []).filter(notification => notification.userId === userId);
  }, [query.data, userId]);

  return {
    notifications: data,
    isLoading: query.isLoading,
    error: query.error,
    refresh: query.refresh,
  };
}
