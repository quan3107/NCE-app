/**
 * Location: src/lib/auth-types.ts
 * Purpose: Define shared auth session, payload, and context types.
 * Why: Keeps auth provider logic focused on behavior rather than model declarations.
 */

import type { Role, User } from '@domain';

export type SupportedRole = Exclude<Role, 'public'>;

export type LiveUser = User;

export type BackendAuthUser = {
  id: string;
  email: string;
  fullName: string;
  role: SupportedRole;
};

export type AuthSuccessResponse = {
  user: BackendAuthUser;
  accessToken: string;
};

export type AuthPendingApprovalResponse = {
  status: 'pending_approval';
  message: string;
  user: BackendAuthUser & {
    status: 'pending';
  };
};

export type RegisterRole = Exclude<SupportedRole, 'admin'>;
export type RegisterResult = 'live' | 'pending_approval';

export type RegisterPayload = {
  fullName: string;
  email: string;
  password: string;
  role: RegisterRole;
};

export type StoredAuthPayload = {
  token?: string | null;
  liveUser?: LiveUser | null;
};

export type AuthContextType = {
  currentUser: User;
  isAuthenticated: boolean;
  isRestoringSession: boolean;
  login: (email: string, password: string) => Promise<'live' | null>;
  register: (payload: RegisterPayload) => Promise<RegisterResult>;
  loginWithGoogle: () => Promise<void>;
  completeGoogleLogin: () => Promise<'live'>;
  restoreLiveSession: () => Promise<boolean>;
  logout: () => Promise<void>;
};

export type PersistSnapshot = {
  token: string | null;
  liveUser: LiveUser | null;
};

export type InitialSnapshot = PersistSnapshot;
