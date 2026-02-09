/**
 * File: src/modules/navigation/navigation.service.ts
 * Purpose: Provide navigation-related business logic.
 * Why: Centralizes navigation retrieval and filtering.
 */

import { prisma } from "../../prisma/client.js";
import type { UserRole } from "../../prisma/index.js";
import { getPermissionsForRole } from "../permissions/permissions.service.js";
import { getFeatureFlagsForRole } from "../feature-flags/feature-flags.service.js";
import type { NavigationResponse, NavigationItem } from "./navigation.types.js";

const NAVIGATION_VERSION = "2026-02-09-001";

/**
 * Get navigation items for a specific role.
 * Returns items filtered by role, active status, and ordered by orderIndex.
 */
export async function getNavigationItemsForRole(role: UserRole): Promise<NavigationItem[]> {
  const items = await prisma.navigationItem.findMany({
    where: {
      role,
      isActive: true,
      parentId: null, // Only top-level items
    },
    orderBy: {
      orderIndex: "asc",
    },
    include: {
      children: {
        where: {
          isActive: true,
        },
        orderBy: {
          orderIndex: "asc",
        },
      },
    },
  });

  return items.map(mapNavigationItem);
}

/**
 * Get complete navigation response for a user.
 * Includes items, permissions, feature flags, and version.
 */
export async function getNavigationForRole(role: UserRole): Promise<NavigationResponse> {
  const [items, permissions, featureFlags] = await Promise.all([
    getNavigationItemsForRole(role),
    getPermissionsForRole(role),
    getFeatureFlagsForRole(role),
  ]);

  return {
    items,
    permissions,
    featureFlags,
    version: NAVIGATION_VERSION,
  };
}

/**
 * Map a database navigation item to the response type.
 */
function mapNavigationItem(item: {
  id: string;
  label: string;
  path: string;
  iconName: string;
  requiredPermission: string | null;
  orderIndex: number;
  badgeSource: string | null;
  isActive: boolean;
  featureFlag: string | null;
  children: Array<{
    id: string;
    label: string;
    path: string;
    iconName: string;
    requiredPermission: string | null;
    orderIndex: number;
    badgeSource: string | null;
    isActive: boolean;
    featureFlag: string | null;
  }>;
}): NavigationItem {
  return {
    id: item.id,
    label: item.label,
    path: item.path,
    iconName: item.iconName,
    requiredPermission: item.requiredPermission,
    orderIndex: item.orderIndex,
    badgeSource: item.badgeSource,
    children: item.children.map((child) => ({
      id: child.id,
      label: child.label,
      path: child.path,
      iconName: child.iconName,
      requiredPermission: child.requiredPermission,
      orderIndex: child.orderIndex,
      badgeSource: child.badgeSource,
      children: [], // No nested children beyond level 2
      isActive: child.isActive,
      featureFlag: child.featureFlag,
    })),
    isActive: item.isActive,
    featureFlag: item.featureFlag,
  };
}
