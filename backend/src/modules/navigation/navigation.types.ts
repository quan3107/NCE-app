/**
 * File: src/modules/navigation/navigation.types.ts
 * Purpose: Define types for the navigation module.
 * Why: Keeps navigation-related types centralized and consistent.
 */

export type NavigationItem = {
  id: string;
  label: string;
  path: string;
  iconName: string;
  requiredPermission: string | null;
  orderIndex: number;
  badgeSource: string | null;
  children: NavigationItem[];
  isActive: boolean;
  featureFlag: string | null;
};

export type NavigationResponse = {
  items: NavigationItem[];
  permissions: string[];
  featureFlags: Record<string, boolean>;
  version: string;
};
