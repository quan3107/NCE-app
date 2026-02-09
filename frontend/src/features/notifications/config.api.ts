/**
 * Location: features/notifications/config.api.ts
 * Purpose: Fetch notification type metadata used by notification filters and labels.
 * Why: Replaces hardcoded frontend notification type lists with backend-managed config.
 */

import { useQuery } from '@tanstack/react-query';

import { ApiError, apiClient } from '@lib/apiClient';

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

const NOTIFICATION_TYPES_QUERY_KEY = 'config:notification-types';

const FALLBACK_NOTIFICATION_TYPES: NotificationTypeConfig[] = [
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
];

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function toFallbackTypes(): NotificationTypeConfig[] {
  return FALLBACK_NOTIFICATION_TYPES.map(type => ({ ...type }));
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

export async function fetchNotificationTypes(): Promise<NotificationTypeConfig[]> {
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
          fallbackCount: FALLBACK_NOTIFICATION_TYPES.length,
        },
      );
      return toFallbackTypes();
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
        fallbackCount: FALLBACK_NOTIFICATION_TYPES.length,
      },
    );
    return toFallbackTypes();
  }
}

export function useNotificationTypes() {
  return useQuery({
    queryKey: [NOTIFICATION_TYPES_QUERY_KEY],
    queryFn: fetchNotificationTypes,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 1,
  });
}

export function getNotificationTypeFallback(): NotificationTypeConfig[] {
  return toFallbackTypes();
}
