/**
 * Location: src/features/notifications/preferences.api.ts
 * Purpose: Provide API hooks for authenticated user notification preference management.
 * Why: Ensures teacher filter toggles are persisted and enforced by backend delivery logic.
 */

import { useMutation, useQuery } from '@tanstack/react-query';

import { apiClient } from '@lib/apiClient';
import { queryClient } from '@lib/queryClient';
import type { Role } from '@domain';

type NotificationRole = Exclude<Role, 'public'>;

export type NotificationPreferenceType = {
  id: string;
  label: string;
  description: string;
  category: string;
  defaultEnabled: boolean;
  enabled: boolean;
  sortOrder: number;
};

export type MyNotificationPreferencesResponse = {
  role: NotificationRole;
  version: string;
  personalized: boolean;
  types: NotificationPreferenceType[];
};

export type UpdateMyNotificationPreferencesRequest = {
  types: Array<{
    id: string;
    enabled: boolean;
  }>;
};

type ApiNotificationPreferenceType = {
  id: string;
  label: string;
  description: string;
  category: string;
  default_enabled: boolean;
  enabled: boolean;
  sort_order: number;
};

type ApiMyNotificationPreferencesResponse = {
  role: NotificationRole;
  version: string;
  personalized: boolean;
  types: ApiNotificationPreferenceType[];
};

const MY_NOTIFICATION_PREFERENCES_QUERY_KEY = 'notification-preferences:me';

function mapNotificationPreferenceType(type: ApiNotificationPreferenceType): NotificationPreferenceType {
  return {
    id: type.id,
    label: type.label,
    description: type.description,
    category: type.category,
    defaultEnabled: type.default_enabled,
    enabled: type.enabled,
    sortOrder: type.sort_order,
  };
}

function mapMyNotificationPreferencesResponse(
  payload: ApiMyNotificationPreferencesResponse,
): MyNotificationPreferencesResponse {
  return {
    role: payload.role,
    version: payload.version,
    personalized: payload.personalized,
    types: payload.types
      .map(mapNotificationPreferenceType)
      .sort((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id)),
  };
}

export async function fetchMyNotificationPreferences(): Promise<MyNotificationPreferencesResponse> {
  const payload = await apiClient<ApiMyNotificationPreferencesResponse>(
    '/api/v1/me/notification-preferences',
  );
  return mapMyNotificationPreferencesResponse(payload);
}

export async function saveMyNotificationPreferences(
  request: UpdateMyNotificationPreferencesRequest,
): Promise<MyNotificationPreferencesResponse> {
  const payload = await apiClient<
    ApiMyNotificationPreferencesResponse,
    UpdateMyNotificationPreferencesRequest
  >('/api/v1/me/notification-preferences', {
    method: 'PUT',
    body: request,
  });
  return mapMyNotificationPreferencesResponse(payload);
}

export async function resetMyNotificationPreferences(): Promise<void> {
  await apiClient('/api/v1/me/notification-preferences', {
    method: 'DELETE',
    parseJson: false,
  });
}

export function useMyNotificationPreferences() {
  return useQuery({
    queryKey: [MY_NOTIFICATION_PREFERENCES_QUERY_KEY],
    queryFn: fetchMyNotificationPreferences,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

export function useSaveMyNotificationPreferences() {
  return useMutation({
    mutationFn: saveMyNotificationPreferences,
    onSuccess: (payload) => {
      queryClient.setQueryData([MY_NOTIFICATION_PREFERENCES_QUERY_KEY], payload);
    },
  });
}

export function useResetMyNotificationPreferences() {
  return useMutation({
    mutationFn: resetMyNotificationPreferences,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: [MY_NOTIFICATION_PREFERENCES_QUERY_KEY],
      });
    },
  });
}
