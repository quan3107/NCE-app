/**
 * Location: src/features/navigation/utils/fallbackNav.ts
 * Purpose: Provide safe static navigation for public unauthenticated surfaces.
 * Why: Authenticated navigation must come from the backend /me payload.
 */

import type { NavigationItem, NavigationPayload } from '../types';

const FALLBACK_VERSION = 'fallback-2026-06-18-001';

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

const publicNavigation: NavigationPayload = {
  items: publicItems,
  permissions: [],
  featureFlags: {},
  version: FALLBACK_VERSION,
};

export function getFallbackNavigation(): NavigationPayload {
  return publicNavigation;
}
