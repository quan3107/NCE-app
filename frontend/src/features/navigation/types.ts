/**
 * Location: src/features/navigation/types.ts
 * Purpose: Define shared types and runtime guards for the navigation module.
 * Why: Keeps API parsing, cache validation, and context contracts consistent.
 */

import type { Role } from '@types/domain';

export const BADGE_SOURCES = ['notifications', 'assignments', 'submissions'] as const;

export type BadgeSource = (typeof BADGE_SOURCES)[number];

export type BadgeCounts = {
  notifications: number;
  assignments: number;
  submissions: number;
};

export type NavigationItem = {
  id: string;
  label: string;
  path: string;
  iconName: string;
  requiredPermission: string | null;
  orderIndex: number;
  badgeSource: BadgeSource | null;
  children: NavigationItem[];
  isActive: boolean;
  featureFlag: string | null;
};

export type NavigationPayload = {
  items: NavigationItem[];
  permissions: string[];
  featureFlags: Record<string, boolean>;
  version: string;
};

export type NavigationSource = 'live' | 'cache' | 'fallback';

export type NavigationContextValue = {
  navigation: NavigationPayload;
  items: NavigationItem[];
  source: NavigationSource;
  isLoading: boolean;
  error: Error | null;
  badgeCounts: BadgeCounts;
  hasPermission: (requiredPermission: string | null | undefined) => boolean;
  hasAnyPermission: (requiredPermissions: string[]) => boolean;
  hasAllPermissions: (requiredPermissions: string[]) => boolean;
  isFeatureEnabled: (featureFlag: string | null | undefined) => boolean;
  refetch: () => Promise<void>;
};

export type NavigationCacheRecord = {
  data: NavigationPayload;
  role: Role;
  timestamp: number;
};

export type BadgeCacheRecord = {
  data: BadgeCounts;
  role: Role;
  timestamp: number;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

const isBadgeSourceValue = (value: unknown): value is BadgeSource =>
  typeof value === 'string' && BADGE_SOURCES.includes(value as BadgeSource);

const isFeatureFlagsMap = (value: unknown): value is Record<string, boolean> => {
  if (!isRecord(value)) {
    return false;
  }

  return Object.values(value).every((entry) => typeof entry === 'boolean');
};

export const isBadgeCounts = (value: unknown): value is BadgeCounts => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.notifications === 'number' &&
    typeof value.assignments === 'number' &&
    typeof value.submissions === 'number'
  );
};

export const isNavigationItem = (value: unknown): value is NavigationItem => {
  if (!isRecord(value)) {
    return false;
  }

  if (
    typeof value.id !== 'string' ||
    typeof value.label !== 'string' ||
    typeof value.path !== 'string' ||
    typeof value.iconName !== 'string' ||
    typeof value.orderIndex !== 'number' ||
    typeof value.isActive !== 'boolean'
  ) {
    return false;
  }

  if (value.requiredPermission !== null && typeof value.requiredPermission !== 'string') {
    return false;
  }

  if (value.featureFlag !== null && typeof value.featureFlag !== 'string') {
    return false;
  }

  if (value.badgeSource !== null && !isBadgeSourceValue(value.badgeSource)) {
    return false;
  }

  if (!Array.isArray(value.children)) {
    return false;
  }

  return value.children.every(isNavigationItem);
};

export const isNavigationPayload = (value: unknown): value is NavigationPayload => {
  if (!isRecord(value)) {
    return false;
  }

  if (!Array.isArray(value.items) || !value.items.every(isNavigationItem)) {
    return false;
  }

  if (!isStringArray(value.permissions)) {
    return false;
  }

  if (!isFeatureFlagsMap(value.featureFlags)) {
    return false;
  }

  return typeof value.version === 'string';
};
