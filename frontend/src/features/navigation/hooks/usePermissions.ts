/**
 * Location: src/features/navigation/hooks/usePermissions.ts
 * Purpose: Expose permission-check helpers for navigation and feature gating.
 * Why: Centralizes permission logic so filtering behavior stays consistent.
 */

import { useCallback, useMemo } from 'react';

export const hasPermission = (
  requiredPermission: string | null | undefined,
  userPermissions: string[],
): boolean => {
  if (!requiredPermission) {
    return true;
  }

  return userPermissions.includes(requiredPermission);
};

export const hasAnyPermission = (
  requiredPermissions: string[],
  userPermissions: string[],
): boolean => {
  if (requiredPermissions.length === 0) {
    return true;
  }

  return requiredPermissions.some((permission) => userPermissions.includes(permission));
};

export const hasAllPermissions = (
  requiredPermissions: string[],
  userPermissions: string[],
): boolean => {
  if (requiredPermissions.length === 0) {
    return true;
  }

  return requiredPermissions.every((permission) => userPermissions.includes(permission));
};

export function usePermissions(permissions: string[]) {
  const normalizedPermissions = useMemo(() => permissions ?? [], [permissions]);

  const checkPermission = useCallback(
    (requiredPermission: string | null | undefined) =>
      hasPermission(requiredPermission, normalizedPermissions),
    [normalizedPermissions],
  );

  const checkAnyPermission = useCallback(
    (requiredPermissions: string[]) => hasAnyPermission(requiredPermissions, normalizedPermissions),
    [normalizedPermissions],
  );

  const checkAllPermissions = useCallback(
    (requiredPermissions: string[]) => hasAllPermissions(requiredPermissions, normalizedPermissions),
    [normalizedPermissions],
  );

  return {
    permissions: normalizedPermissions,
    hasPermission: checkPermission,
    hasAnyPermission: checkAnyPermission,
    hasAllPermissions: checkAllPermissions,
  };
}
