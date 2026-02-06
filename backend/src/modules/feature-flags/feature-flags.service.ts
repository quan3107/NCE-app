/**
 * File: src/modules/feature-flags/feature-flags.service.ts
 * Purpose: Provide feature flag-related business logic.
 * Why: Centralizes feature flag checking and retrieval.
 */

import { prisma } from "../../prisma/client.js";
import type { UserRole } from "../../prisma/index.js";
import type { FeatureFlagsMap } from "./feature-flags.types.js";

/**
 * Get all enabled feature flags for a specific role as a map.
 * Returns only flags that are both enabled globally and assigned to the role.
 */
export async function getFeatureFlagsForRole(role: UserRole): Promise<FeatureFlagsMap> {
  const featureFlags = await prisma.featureFlag.findMany({
    where: {
      enabled: true,
      roles: {
        some: {
          role,
        },
      },
    },
    select: {
      key: true,
      enabled: true,
    },
  });

  return featureFlags.reduce((acc, flag) => {
    acc[flag.key] = flag.enabled;
    return acc;
  }, {} as FeatureFlagsMap);
}

/**
 * Check if a feature flag is enabled for a specific role.
 */
export async function isFeatureEnabled(
  flagKey: string,
  role: UserRole
): Promise<boolean> {
  const featureFlag = await prisma.featureFlag.findFirst({
    where: {
      key: flagKey,
      enabled: true,
      roles: {
        some: {
          role,
        },
      },
    },
  });

  return !!featureFlag;
}

/**
 * Check if a feature is enabled using a pre-fetched feature flags map.
 * This is more efficient when you already have the map.
 */
export function isFeatureEnabledFromMap(
  featureFlags: FeatureFlagsMap,
  flagKey: string
): boolean {
  return featureFlags[flagKey] === true;
}
