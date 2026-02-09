/**
 * Location: features/courses/management/courseTabs.config.api.ts
 * Purpose: Fetch course management tab metadata for teacher course workspace rendering.
 * Why: Replaces hardcoded tab labels/icons with backend-managed configuration and fallback logs.
 */

import { useQuery } from '@tanstack/react-query';

import { ApiError, apiClient } from '@lib/apiClient';

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

const COURSE_MANAGEMENT_TABS_FALLBACK: CourseManagementTabConfig[] = [
  {
    id: 'overview',
    label: 'Overview',
    icon: 'book-open',
    requiredPermission: 'courses:read',
    order: 1,
    enabled: true,
  },
  {
    id: 'students',
    label: 'Students',
    icon: 'users',
    requiredPermission: 'courses:manage',
    order: 2,
    enabled: true,
  },
  {
    id: 'deadlines',
    label: 'Deadlines',
    icon: 'clock',
    requiredPermission: 'assignments:create',
    order: 3,
    enabled: true,
  },
  {
    id: 'announcements',
    label: 'Announcements',
    icon: 'megaphone',
    requiredPermission: 'courses:manage',
    order: 4,
    enabled: true,
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: 'settings',
    requiredPermission: 'rubrics:manage',
    order: 5,
    enabled: true,
  },
];

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function toFallbackTabs(): CourseManagementTabConfig[] {
  return COURSE_MANAGEMENT_TABS_FALLBACK.map((tab) => ({ ...tab }));
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
  try {
    const response = await apiClient<CourseManagementTabsResponse>(
      '/api/v1/config/course-management-tabs',
    );

    if (!Array.isArray(response.tabs)) {
      console.warn(
        '[course-management] invalid course tabs payload; using fallback',
        {
          endpoint: '/api/v1/config/course-management-tabs',
          reason: 'tabs_not_array',
          fallbackCount: COURSE_MANAGEMENT_TABS_FALLBACK.length,
        },
      );
      return toFallbackTabs();
    }

    const mapped = response.tabs
      .map(mapTab)
      .filter((tab): tab is CourseManagementTabConfig => Boolean(tab && tab.enabled));

    if (mapped.length === 0 && response.tabs.length > 0) {
      console.warn(
        '[course-management] invalid course tabs payload; using fallback',
        {
          endpoint: '/api/v1/config/course-management-tabs',
          reason: 'rows_invalid',
          rowCount: response.tabs.length,
          fallbackCount: COURSE_MANAGEMENT_TABS_FALLBACK.length,
        },
      );
      return toFallbackTabs();
    }

    return mapped.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  } catch (error) {
    const status = error instanceof ApiError ? error.status : undefined;

    console.error(
      '[course-management] backend course tabs unavailable; using fallback',
      {
        endpoint: '/api/v1/config/course-management-tabs',
        status,
        reason: 'request_failed',
        fallbackCount: COURSE_MANAGEMENT_TABS_FALLBACK.length,
      },
    );

    return toFallbackTabs();
  }
}

export function useCourseManagementTabs() {
  return useQuery({
    queryKey: [COURSE_MANAGEMENT_TABS_QUERY_KEY],
    queryFn: fetchCourseManagementTabs,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 1,
  });
}

export function getCourseManagementTabsFallback(): CourseManagementTabConfig[] {
  return toFallbackTabs();
}
