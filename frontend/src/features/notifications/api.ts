/**
 * Location: features/notifications/api.ts
 * Purpose: Centralize notification queries and mutations backed by React Query.
 * Why: Keeps UI layers decoupled from backend wiring while notifications evolve.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { apiClient } from '@lib/apiClient';
import type { Notification } from '@domain';
import { queryClient } from '@lib/queryClient';
import { formatDate } from '@lib/utils';

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

type ApiNotificationsReadResponse = {
  userId: string;
  updatedCount: number;
};

export const mapApiNotificationToNotification = (
  notification: ApiNotification,
): Notification => {
  const payload = notification.payload ?? {};
  const payloadRecord = payload as Record<string, unknown>;
  const isDeadline = notification.type === 'due_soon' && typeof payloadRecord.assignmentId === 'string';
  const deadline = typeof payloadRecord.dueAt === 'string' ? new Date(payloadRecord.dueAt) : null;

  return {
    id: notification.id,
    userId: notification.userId,
    // Preserve raw backend notification keys so new types work without frontend deploys.
    type: notification.type,
    title:
      isDeadline ? `Due soon: ${String(payloadRecord.assignmentTitle ?? 'Assignment')}` : typeof payloadRecord.title === 'string'
        ? payloadRecord.title
        : notification.type.replace(/_/g, ' '),
    message:
      isDeadline && deadline && Number.isFinite(deadline.getTime())
        ? `${String(payloadRecord.courseTitle ?? '')} · Due ${formatDate(deadline, 'datetime')}. Late work has no score penalty; submissions close 24 hours later.`
        : typeof payloadRecord.message === 'string'
        ? payloadRecord.message
        : 'You have a new notification.',
    timestamp: new Date(notification.createdAt),
    read: Boolean(notification.readAt) || notification.status === 'read',
    link: isDeadline ? `/student/assignments/${encodeURIComponent(String(payloadRecord.assignmentId))}` : typeof payloadRecord.link === 'string' ? payloadRecord.link : undefined,
  };
};

const fetchNotifications = async (): Promise<Notification[]> => {
  const response = await apiClient<ApiNotification[]>('/api/v1/notifications', {
    auth: 'required',
  });
  return response.map(mapApiNotificationToNotification);
};

export function useNotificationsQuery() {
  return useQuery({
    queryKey: NOTIFICATIONS_KEY,
    queryFn: fetchNotifications,
  });
}

export function markNotificationsRead(params: { userId: string; notificationIds?: string[] }) {
  const { userId, notificationIds } = params;

  return apiClient<ApiNotificationsReadResponse>('/api/v1/notifications/read', {
    auth: 'required',
    method: 'POST',
    body: {
      userId,
      notificationIds,
    },
  })
    .then(() => {
      const existing = queryClient.getQueryData<Notification[]>(NOTIFICATIONS_KEY) ?? [];

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
    })
    .catch(() => {
      // Keep UI state unchanged if the API request fails.
    });
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
