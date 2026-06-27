/**
 * Location: features/notifications/config.api.ts
 * Purpose: Fetch notification type metadata used by notification filters and labels.
 * Why: Replaces hardcoded frontend notification type lists with backend-managed config.
 */

import { useQuery } from '@tanstack/react-query';

import { apiClient } from '@lib/apiClient';
import type { Role } from '@domain';

export type NotificationTypeConfig = {
  id: string;
  label: string;
  description: string;
  category: string;
  icon?: string;
  accent?: string;
  defaultEnabled: boolean;
  enabled: boolean;
  sortOrder: number;
};

type NotificationTypeConfigApi = {
  id: string;
  label: string;
  description: string;
  category: string;
  icon?: string;
  accent?: string;
  default_enabled: boolean;
  enabled: boolean;
  sort_order: number;
};

type NotificationTypesResponse = {
  types: NotificationTypeConfigApi[];
};

type NotificationRole = Exclude<Role, 'public'>;

const NOTIFICATION_TYPES_QUERY_KEY = 'config:notification-types';

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
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
    icon: normalizeText(record.icon) || undefined,
    accent: normalizeText(record.accent) || undefined,
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
  _role: NotificationRole = 'student',
): Promise<NotificationTypeConfig[]> {
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
    throw new Error('Invalid notification types payload returned by API.');
  }

  return mapped.sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
}

export function useNotificationTypes(role: NotificationRole = 'student') {
  return useQuery({
    queryKey: [NOTIFICATION_TYPES_QUERY_KEY, role],
    queryFn: () => fetchNotificationTypes(role),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 0,
  });
}
