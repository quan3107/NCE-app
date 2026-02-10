/**
 * Location: src/types/domain/auth.ts
 * Purpose: Define shared authentication and identity domain types.
 * Why: Keeps core role/user contracts independent from any mock data module.
 */

export type Role = 'student' | 'teacher' | 'admin' | 'public';

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatar?: string;
};
