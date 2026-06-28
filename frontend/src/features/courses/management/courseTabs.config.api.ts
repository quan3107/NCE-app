/**
 * Location: features/courses/management/courseTabs.config.api.ts
 * Purpose: Fetch course management tab metadata for teacher course workspace rendering.
 * Why: Replaces hardcoded tab labels/icons with backend-managed configuration.
 */

import { useQuery } from '@tanstack/react-query';

import { apiClient } from '@lib/apiClient';

export type CourseManagementTabConfig = {
  id: string;
  label: string;
  icon: string;
  requiredPermission: string | null;
  order: number;
  enabled: boolean;
};

type CourseManagementTabConfigApi = {
  id: string;
  label: string;
  icon: string;
  required_permission: string | null;
  order: number;
  enabled: boolean;
};

type CourseManagementTabsResponse = {
  tabs: CourseManagementTabConfigApi[];
};

const COURSE_MANAGEMENT_TABS_QUERY_KEY = 'config:course-management-tabs';

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function mapTab(value: unknown): CourseManagementTabConfig | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const id = normalizeText(record.id);
  const label = normalizeText(record.label);
  const icon = normalizeText(record.icon);

  if (!id || !label || !icon) {
    return null;
  }

  return {
    id,
    label,
    icon,
    requiredPermission: normalizeText(record.required_permission) || null,
    order: typeof record.order === 'number' ? record.order : 0,
    enabled: typeof record.enabled === 'boolean' ? record.enabled : true,
  };
}

export async function fetchCourseManagementTabs(): Promise<CourseManagementTabConfig[]> {
  const response = await apiClient<CourseManagementTabsResponse>(
    '/api/v1/config/course-management-tabs',
  );

  if (!Array.isArray(response.tabs)) {
    throw new Error('Invalid course management tabs payload returned by API.');
  }

  const mapped = response.tabs
    .map(mapTab)
    .filter((tab): tab is CourseManagementTabConfig => Boolean(tab && tab.enabled));

  if (mapped.length === 0 && response.tabs.length > 0) {
    throw new Error('Invalid course management tab rows returned by API.');
  }

  return mapped.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}

export function useCourseManagementTabs() {
  return useQuery({
    queryKey: [COURSE_MANAGEMENT_TABS_QUERY_KEY],
    queryFn: fetchCourseManagementTabs,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 0,
  });
}
