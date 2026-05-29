/**
 * File: src/modules/auth/auth.types.ts
 * Purpose: Define shared auth-facing types used across auth modules.
 * Why: Keeps request/response typing consistent without circular imports.
 */
import type { UserRole } from "../../prisma/index.js";

export type AuthenticatedUser = {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
};

export type AuthSessionResult = {
  user: AuthenticatedUser;
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
};

export type PendingApprovalResult = {
  status: "pending_approval";
  user: AuthenticatedUser & {
    status: "pending";
  };
};

export type RegisterAccountResult = AuthSessionResult | PendingApprovalResult;

export type SessionContext = {
  ipAddress?: string | null;
  userAgent?: string | null;
  refreshToken?: string | null;
};
