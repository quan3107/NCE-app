/**
 * Location: src/types/domain/auth.ts
 * Purpose: Define shared authentication and identity domain types.
 * Why: Keeps core role/user contracts independent from any mock data module.
 */

import type { UserRole } from '@lib/backend-schema';

export type Role = UserRole | 'public';

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatar?: string;
};
