/**
 * File: src/modules/auth/auth.service.ts
 * Purpose: Contain the business logic stubs for authentication-related workflows.
 * Why: Separates transport concerns from core auth routines for future expansion.
 */
import {
  googleAuthCallbackSchema,
  passwordLoginSchema,
  refreshSessionSchema,
} from "./auth.schema.js";

export async function handlePasswordLogin(payload: unknown): Promise<void> {
  passwordLoginSchema.parse(payload);
}

export async function handleSessionRefresh(payload: unknown): Promise<void> {
  refreshSessionSchema.parse(payload);
}

export async function handleLogout(): Promise<void> {
  // Logout will revoke refresh tokens in a future iteration.
}

export async function buildGoogleAuthorizationUrl(): Promise<void> {
  // Google OIDC authorization URL generation will be implemented later.
}

export async function completeGoogleAuthorization(
  query: unknown,
): Promise<void> {
  googleAuthCallbackSchema.parse(query);
}
