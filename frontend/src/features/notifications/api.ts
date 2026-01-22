/**
 * Location: features/notifications/api.ts
 * Purpose: Centralize notification queries and mutations backed by React Query.
 * Why: Keeps UI layers decoupled from backend wiring while notifications evolve.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { apiClient } from '@lib/apiClient';
import { Notification } from '@lib/mock-data';
import { queryClient } from '@lib/queryClient';

const NOTIFICATIONS_KEY = ['notifications', 'list'] as const;

type ApiNotification = {
  id: string;
  userId: string;
  type: string;
  payload: Record<string, unknown>;
  channel: string;
  status: string;
  readAt?: string | null;
  createdAt: string;
};

const toNotification = (notification: ApiNotification): Notification => {
  const payload = notification.payload ?? {};
  const payloadRecord = payload as Record<string, unknown>;

  return {
    id: notification.id,
    userId: notification.userId,
    type: ['assignment_published', 'due_soon', 'graded', 'reminder'].includes(notification.type)
      ? (notification.type as Notification['type'])
      : 'reminder',
    title:
      typeof payloadRecord.title === 'string'
        ? payloadRecord.title
        : notification.type.replace(/_/g, ' '),
    message:
      typeof payloadRecord.message === 'string'
        ? payloadRecord.message
        : 'You have a new notification.',
    timestamp: new Date(notification.createdAt),
    read: Boolean(notification.readAt) || notification.status === 'read',
    link: typeof payloadRecord.link === 'string' ? payloadRecord.link : undefined,
  };
};

const fetchNotifications = async (): Promise<Notification[]> => {
  const response = await apiClient<ApiNotification[]>('/api/v1/notifications');
  return response.map(toNotification);
};

export function useNotificationsQuery() {
  return useQuery({
    queryKey: NOTIFICATIONS_KEY,
    queryFn: fetchNotifications,
  });
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
    refetch: query.refetch,
  };
}
