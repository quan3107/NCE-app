/**
 * File: src/modules/permissions/permissions.service.ts
 * Purpose: Provide permission-related business logic.
 * Why: Centralizes permission checking and retrieval.
 */

import { prisma } from "../../prisma/client.js";
import type { UserRole } from "../../prisma/index.js";

/**
 * Get all permissions for a specific role.
 */
export async function getPermissionsForRole(role: UserRole): Promise<string[]> {
  const rolePermissions = await prisma.rolePermission.findMany({
    where: { role },
    include: { permission: true },
  });

  return rolePermissions.map((rp) => rp.permission.key);
}

/**
 * Check if a user has a specific permission.
 */
export function hasPermission(
  userPermissions: string[],
  requiredPermission: string
): boolean {
  return userPermissions.includes(requiredPermission);
}

/**
 * Check if a user has any of the specified permissions.
 */
export function hasAnyPermission(
  userPermissions: string[],
  requiredPermissions: string[]
): boolean {
  return requiredPermissions.some((perm) => userPermissions.includes(perm));
}

/**
 * Check if a user has all of the specified permissions.
 */
export function hasAllPermissions(
  userPermissions: string[],
  requiredPermissions: string[]
): boolean {
  return requiredPermissions.every((perm) => userPermissions.includes(perm));
}
