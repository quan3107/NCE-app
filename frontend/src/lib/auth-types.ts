/**
 * Location: src/lib/auth-types.ts
 * Purpose: Define shared auth session, payload, and context types.
 * Why: Keeps auth provider logic focused on behavior rather than model declarations.
 */

import type { Role, User } from '@domain';
import type { PersonaKey } from './devPersonas';

export type AuthMode = 'live' | 'persona';
export type SupportedRole = Exclude<Role, 'public'>;

export type PersonaState = {
  basePersona: PersonaKey;
  actingPersona: PersonaKey | null;
};

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
  mode?: AuthMode;
  token?: string | null;
  persona?: PersonaState;
  liveUser?: LiveUser | null;
  basePersona?: PersonaKey;
  actingPersona?: PersonaKey | null;
  effective?: {
    id?: string;
    role?: Role;
  };
  id?: string;
  role?: Role;
};

export type AuthContextType = {
  authMode: AuthMode;
  currentUser: User;
  isAuthenticated: boolean;
  isRestoringSession: boolean;
  actingRole: Role | null;
  isImpersonating: boolean;
  login: (email: string, password: string) => Promise<AuthMode | null>;
  register: (payload: RegisterPayload) => Promise<RegisterResult>;
  loginWithGoogle: () => Promise<void>;
  completeGoogleLogin: () => Promise<'live'>;
  restoreLiveSession: () => Promise<boolean>;
  logout: () => Promise<void>;
  switchRole: (role: Role) => void;
  viewAs: (role: Role) => void;
  stopImpersonating: () => void;
};

export type PersistSnapshot = {
  mode: AuthMode;
  token: string | null;
  persona: PersonaState;
  liveUser: LiveUser | null;
};

export type InitialSnapshot = PersistSnapshot;
