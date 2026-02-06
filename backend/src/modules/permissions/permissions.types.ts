/**
 * File: src/modules/permissions/permissions.types.ts
 * Purpose: Define types for the permissions module.
 * Why: Keeps permission-related types centralized and consistent.
 */

export type Permission = {
  id: string;
  key: string;
  name: string;
  description: string | null;
};

export type RolePermission = {
  id: string;
  role: string;
  permissionId: string;
};
