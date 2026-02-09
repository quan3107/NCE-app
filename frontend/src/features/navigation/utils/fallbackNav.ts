/**
 * Location: src/features/navigation/utils/fallbackNav.ts
 * Purpose: Provide role-based fallback navigation when backend data is unavailable.
 * Why: Preserves baseline navigation behavior during API failures or first-load offline cases.
 */

import type { Role } from '@lib/mock-data';

import type { NavigationItem, NavigationPayload } from '../types';

const FALLBACK_VERSION = 'fallback-2026-02-09-001';

const n = (
  id: string,
  label: string,
  path: string,
  iconName: string,
  orderIndex: number,
  options?: {
    requiredPermission?: string;
    badgeSource?: NavigationItem['badgeSource'];
    featureFlag?: string;
  },
): NavigationItem => ({
  id,
  label,
  path,
  iconName,
  requiredPermission: options?.requiredPermission ?? null,
  orderIndex,
  badgeSource: options?.badgeSource ?? null,
  children: [],
  isActive: true,
  featureFlag: options?.featureFlag ?? null,
});

const publicItems: NavigationItem[] = [
  n('public-home', 'Home', '/', 'home', 0),
  n('public-courses', 'Courses', '/courses', 'book-open', 1),
  n('public-about', 'About', '/about', 'info', 2),
  n('public-contact', 'Contact', '/contact', 'mail', 3),
];

const studentItems: NavigationItem[] = [
  n('student-dashboard', 'Dashboard', '/student/dashboard', 'layout-dashboard', 0, { requiredPermission: 'dashboard:view' }),
  n('student-assignments', 'Assignments', '/student/assignments', 'file-text', 1, { requiredPermission: 'assignments:read', badgeSource: 'assignments' }),
  n('student-grades', 'Grades', '/student/grades', 'graduation-cap', 2, { requiredPermission: 'grades:view' }),
  n('student-notifications', 'Notifications', '/student/notifications', 'bell', 3, { requiredPermission: 'notifications:read', badgeSource: 'notifications' }),
  n('student-profile', 'Profile', '/student/profile', 'user', 4, { requiredPermission: 'profile:view' }),
];

const teacherItems: NavigationItem[] = [
  n('teacher-dashboard', 'Dashboard', '/teacher/dashboard', 'layout-dashboard', 0, { requiredPermission: 'dashboard:view' }),
  n('teacher-courses', 'Courses', '/teacher/courses', 'book-open', 1, { requiredPermission: 'courses:read' }),
  n('teacher-assignments', 'Assignments', '/teacher/assignments', 'file-text', 2, { requiredPermission: 'assignments:create' }),
  n('teacher-submissions', 'Submissions', '/teacher/submissions', 'scroll-text', 3, { requiredPermission: 'submissions:read', badgeSource: 'submissions' }),
  n('teacher-notifications', 'Notifications', '/teacher/notifications', 'bell', 4, { requiredPermission: 'notifications:read', badgeSource: 'notifications' }),
  n('teacher-rubrics', 'Rubrics', '/teacher/rubrics', 'book-marked', 5, { requiredPermission: 'rubrics:manage' }),
  n('teacher-analytics', 'Analytics', '/teacher/analytics', 'bar-chart-3', 6, { requiredPermission: 'analytics:view' }),
  n('teacher-profile', 'Profile', '/teacher/profile', 'user', 7, { requiredPermission: 'profile:view' }),
];

const adminItems: NavigationItem[] = [
  n('admin-dashboard', 'Dashboard', '/admin/dashboard', 'layout-dashboard', 0, { requiredPermission: 'dashboard:view' }),
  n('admin-users', 'Users', '/admin/users', 'users', 1, { requiredPermission: 'users:manage' }),
  n('admin-courses', 'Courses', '/admin/courses', 'book-open', 2, { requiredPermission: 'courses:manage' }),
  n('admin-enrollments', 'Enrollments', '/admin/enrollments', 'graduation-cap', 3, { requiredPermission: 'enrollments:manage' }),
  n('admin-audit-logs', 'Audit Logs', '/admin/logs', 'scroll-text', 4, { requiredPermission: 'audit-logs:view' }),
  n('admin-settings', 'Settings', '/admin/settings', 'settings', 5, { requiredPermission: 'settings:manage' }),
];

const fallbackByRole: Record<Role, NavigationPayload> = {
  public: { items: publicItems, permissions: [], featureFlags: {}, version: FALLBACK_VERSION },
  student: {
    items: studentItems,
    permissions: ['dashboard:view', 'assignments:read', 'assignments:submit', 'grades:view', 'notifications:read', 'profile:view', 'profile:edit'],
    featureFlags: {},
    version: FALLBACK_VERSION,
  },
  teacher: {
    items: teacherItems,
    permissions: ['dashboard:view', 'courses:read', 'courses:manage', 'assignments:create', 'assignments:edit', 'assignments:delete', 'submissions:read', 'submissions:grade', 'notifications:read', 'rubrics:manage', 'analytics:view', 'profile:view', 'profile:edit'],
    featureFlags: {},
    version: FALLBACK_VERSION,
  },
  admin: {
    items: adminItems,
    permissions: ['dashboard:view', 'users:manage', 'courses:manage', 'enrollments:manage', 'audit-logs:view', 'settings:manage', 'profile:view', 'profile:edit'],
    featureFlags: {},
    version: FALLBACK_VERSION,
  },
};

export function getFallbackNavigation(role: Role): NavigationPayload {
  return fallbackByRole[role] ?? fallbackByRole.public;
}
