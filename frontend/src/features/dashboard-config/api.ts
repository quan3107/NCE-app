/**
 * Location: src/features/dashboard-config/api.ts
 * Purpose: Provide API helpers for dashboard widget defaults and user personalization.
 * Why: Centralizes payload validation and endpoint access for dashboard routes.
 */

import { ApiError, apiClient } from '@lib/apiClient';

import {
  getFallbackDashboardWidgetDefaults,
} from './fallback';
import {
  type DashboardWidgetDefaultsResponse,
  type MyDashboardConfigResponse,
  type UpdateMyDashboardConfigRequest,
  isDashboardWidgetDefaultsResponse,
  isMyDashboardConfigResponse,
} from './types';

const DEFAULT_ERROR_MESSAGE = 'Unable to load dashboard widget configuration.';

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    return error.message || fallback;
  }

  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return fallback;
}

export async function fetchDashboardWidgetDefaults(
  role: 'student' | 'teacher' | 'admin',
): Promise<DashboardWidgetDefaultsResponse> {
  try {
    const response = await apiClient<unknown>('/api/v1/config/dashboard-widgets');

    if (!isDashboardWidgetDefaultsResponse(response)) {
      throw new Error('Invalid dashboard widget defaults payload returned by API.');
    }

    return response;
  } catch {
    return getFallbackDashboardWidgetDefaults(role);
  }
}

export async function fetchMyDashboardConfig(): Promise<MyDashboardConfigResponse> {
  try {
    const response = await apiClient<unknown>('/api/v1/me/dashboard-config');

    if (!isMyDashboardConfigResponse(response)) {
      throw new Error('Invalid dashboard widget config payload returned by API.');
    }

    return response;
  } catch (error) {
    throw new Error(toErrorMessage(error, DEFAULT_ERROR_MESSAGE));
  }
}

export async function saveMyDashboardConfig(
  payload: UpdateMyDashboardConfigRequest,
): Promise<MyDashboardConfigResponse> {
  try {
    const response = await apiClient<unknown, UpdateMyDashboardConfigRequest>(
      '/api/v1/me/dashboard-config',
      {
        method: 'PUT',
        body: payload,
      },
    );

    if (!isMyDashboardConfigResponse(response)) {
      throw new Error('Invalid dashboard widget config payload returned by API.');
    }

    return response;
  } catch (error) {
    throw new Error(toErrorMessage(error, 'Unable to save dashboard configuration.'));
  }
}

export async function resetMyDashboardConfig(): Promise<void> {
  try {
    await apiClient('/api/v1/me/dashboard-config', {
      method: 'DELETE',
      parseJson: false,
    });
  } catch (error) {
    throw new Error(toErrorMessage(error, 'Unable to reset dashboard configuration.'));
  }
}
