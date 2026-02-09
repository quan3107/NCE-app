/**
 * Location: features/notifications/config.api.ts
 * Purpose: Fetch notification type metadata used by notification filters and labels.
 * Why: Replaces hardcoded frontend notification type lists with backend-managed config.
 */

import { useQuery } from '@tanstack/react-query';

import { ApiError, apiClient } from '@lib/apiClient';
import type { Role } from '@lib/mock-data';

export type NotificationTypeConfig = {
  id: string;
  label: string;
  description: string;
  category: string;
  defaultEnabled: boolean;
  enabled: boolean;
  sortOrder: number;
};

type NotificationTypeConfigApi = {
  id: string;
  label: string;
  description: string;
  category: string;
  default_enabled: boolean;
  enabled: boolean;
  sort_order: number;
};

type NotificationTypesResponse = {
  types: NotificationTypeConfigApi[];
};

type NotificationRole = Exclude<Role, 'public'>;

const NOTIFICATION_TYPES_QUERY_KEY = 'config:notification-types';

const FALLBACK_NOTIFICATION_TYPES_BY_ROLE: Record<NotificationRole, NotificationTypeConfig[]> = {
  student: [
    {
      id: 'assignment_published',
      label: 'Assignment Published',
      description: 'When a new assignment is published.',
      category: 'assignments',
      defaultEnabled: true,
      enabled: true,
      sortOrder: 1,
    },
    {
      id: 'due_soon',
      label: 'Due Soon',
      description: 'When an assignment deadline is approaching.',
      category: 'assignments',
      defaultEnabled: true,
      enabled: true,
      sortOrder: 2,
    },
    {
      id: 'graded',
      label: 'Graded',
      description: 'When feedback and scores are released.',
      category: 'grading',
      defaultEnabled: true,
      enabled: true,
      sortOrder: 3,
    },
    {
      id: 'reminder',
      label: 'Reminder',
      description: 'General reminders and nudges.',
      category: 'general',
      defaultEnabled: true,
      enabled: true,
      sortOrder: 4,
    },
    {
      id: 'weekly_digest',
      label: 'Weekly Digest',
      description: 'A weekly summary of upcoming coursework.',
      category: 'digest',
      defaultEnabled: true,
      enabled: true,
      sortOrder: 5,
    },
  ],
  teacher: [
    {
      id: 'new_submission',
      label: 'New Submission',
      description: 'When a student submits new work.',
      category: 'grading',
      defaultEnabled: true,
      enabled: true,
      sortOrder: 1,
    },
    {
      id: 'graded',
      label: 'Graded',
      description: 'When grading activity is completed.',
      category: 'grading',
      defaultEnabled: true,
      enabled: true,
      sortOrder: 2,
    },
    {
      id: 'reminder',
      label: 'Reminder',
      description: 'General reminders and workflow nudges.',
      category: 'general',
      defaultEnabled: true,
      enabled: true,
      sortOrder: 3,
    },
    {
      id: 'weekly_digest',
      label: 'Weekly Digest',
      description: 'A weekly summary of assignment activity.',
      category: 'digest',
      defaultEnabled: true,
      enabled: true,
      sortOrder: 4,
    },
  ],
  admin: [
    {
      id: 'reminder',
      label: 'Reminder',
      description: 'General operational reminders.',
      category: 'general',
      defaultEnabled: true,
      enabled: true,
      sortOrder: 1,
    },
    {
      id: 'weekly_digest',
      label: 'Weekly Digest',
      description: 'A weekly platform activity summary.',
      category: 'digest',
      defaultEnabled: true,
      enabled: true,
      sortOrder: 2,
    },
    {
      id: 'schedule_update',
      label: 'Schedule Update',
      description: 'When class schedules or events are updated.',
      category: 'system',
      defaultEnabled: true,
      enabled: true,
      sortOrder: 3,
    },
  ],
};

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function toFallbackTypes(role: NotificationRole): NotificationTypeConfig[] {
  const fallback = FALLBACK_NOTIFICATION_TYPES_BY_ROLE[role]
    ?? FALLBACK_NOTIFICATION_TYPES_BY_ROLE.student;
  return fallback.map(type => ({ ...type }));
}

function mapNotificationType(value: unknown): NotificationTypeConfig | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const id = normalizeText(record.id);
  const label = normalizeText(record.label);

  if (!id || !label) {
    return null;
  }

  return {
    id,
    label,
    description: normalizeText(record.description),
    category: normalizeText(record.category) || 'general',
    defaultEnabled:
      typeof record.default_enabled === 'boolean' ? record.default_enabled : true,
    enabled: typeof record.enabled === 'boolean' ? record.enabled : true,
    sortOrder: typeof record.sort_order === 'number' ? record.sort_order : 0,
  };
}

function createReadableTypeLabel(type: string): string {
  return type
    .split('_')
    .filter(Boolean)
    .map(token => token.charAt(0).toUpperCase() + token.slice(1))
    .join(' ');
}

export function getNotificationTypeLabel(
  type: string,
  configuredTypes: NotificationTypeConfig[],
): string {
  const match = configuredTypes.find(item => item.id === type);
  if (match) {
    return match.label;
  }
  return createReadableTypeLabel(type);
}

export async function fetchNotificationTypes(
  role: NotificationRole = 'student',
): Promise<NotificationTypeConfig[]> {
  try {
    const response = await apiClient<NotificationTypesResponse>(
      '/api/v1/config/notification-types',
    );

    const mapped = Array.isArray(response.types)
      ? response.types
          .map(mapNotificationType)
          .filter(
            (type): type is NotificationTypeConfig =>
              Boolean(type && type.enabled),
          )
      : [];

    if (mapped.length === 0) {
      console.warn(
        '[notifications] invalid notification types payload; using fallback',
        {
          endpoint: '/api/v1/config/notification-types',
          reason: 'empty_or_invalid_types',
          role,
          fallbackCount: FALLBACK_NOTIFICATION_TYPES_BY_ROLE[role].length,
        },
      );
      return toFallbackTypes(role);
    }

    return mapped.sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
  } catch (error) {
    const status = error instanceof ApiError ? error.status : undefined;

    console.error(
      '[notifications] backend notification types unavailable; using fallback',
      {
        endpoint: '/api/v1/config/notification-types',
        status,
        reason: 'request_failed',
        role,
        fallbackCount: FALLBACK_NOTIFICATION_TYPES_BY_ROLE[role].length,
      },
    );
    return toFallbackTypes(role);
  }
}

export function useNotificationTypes(role: NotificationRole = 'student') {
  return useQuery({
    queryKey: [NOTIFICATION_TYPES_QUERY_KEY, role],
    queryFn: () => fetchNotificationTypes(role),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 1,
  });
}

export function getNotificationTypeFallback(
  role: NotificationRole = 'student',
): NotificationTypeConfig[] {
  return toFallbackTypes(role);
}
