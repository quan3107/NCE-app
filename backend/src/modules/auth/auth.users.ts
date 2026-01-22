/**
 * File: src/modules/auth/auth.users.ts
 * Purpose: Share user status checks and response mapping for auth flows.
 * Why: Keeps access-control assertions consistent across auth modules.
 */
import { UserRole, UserStatus } from "@prisma/client";

import { AUTH_ERROR, createAuthError } from "./auth.errors.js";
import type { AuthenticatedUser } from "./auth.types.js";

export type ActiveUserRecord = {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  status: UserStatus;
};

export const toAuthenticatedUser = (record: {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
}): AuthenticatedUser => ({
  id: record.id,
  email: record.email,
  fullName: record.fullName,
  role: record.role,
});

export function assertActiveUser(
  user: {
    status: UserStatus;
    password: string | null;
  },
  options: { requirePassword?: boolean } = {},
): void {
  // Passwordless identity providers skip the password requirement when refreshing sessions.
  const requirePassword = options.requirePassword ?? true;

  if (requirePassword && !user.password) {
    throw createAuthError(401, AUTH_ERROR);
  }

  if (user.status !== UserStatus.active) {
    throw createAuthError(
      403,
      "Account is not active. Contact support for assistance.",
    );
  }
}

export const assertUserIsActive = (user: { status: UserStatus }): void => {
  if (user.status !== UserStatus.active) {
    throw createAuthError(
      403,
      "Account is not active. Contact support for assistance.",
    );
  }
};
