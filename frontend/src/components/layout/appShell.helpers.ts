/**
 * Location: src/components/layout/appShell.helpers.ts
 * Purpose: Centralize AppShell helper logic for role routing and badge source mapping.
 * Why: Keeps layout components focused on rendering while enabling targeted helper tests.
 */

import type { BadgeCounts, BadgeSource } from '@features/navigation/types';
import type { Role } from '@lib/mock-data';

export const DASHBOARD_PATH_BY_ROLE: Record<Role, string> = {
  student: '/student/dashboard',
  teacher: '/teacher/dashboard',
  admin: '/admin/dashboard',
  public: '/',
};

export const resolveProfilePath = (role: Role): string | null => {
  if (role === 'student') {
    return '/student/profile';
  }

  if (role === 'teacher') {
    return '/teacher/profile';
  }

  return null;
};

export const getBadgeCountForSource = (
  badgeSource: BadgeSource | null,
  badgeCounts: BadgeCounts,
): number => {
  if (!badgeSource) {
    return 0;
  }

  return badgeCounts[badgeSource] ?? 0;
};
