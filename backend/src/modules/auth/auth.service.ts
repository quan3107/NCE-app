/**
 * File: src/modules/auth/auth.service.ts
 * Purpose: Export the public auth service API in a single entry point.
 * Why: Keeps external imports stable while the auth logic stays modular.
 */
export type {
  AuthenticatedUser,
  AuthSessionResult,
  SessionContext,
} from "./auth.types.js";

export { REFRESH_TOKEN_TTL_MS } from "./auth.sessions.js";
export { handlePasswordLogin, handleRegisterAccount } from "./auth.password.js";
export { handleSessionRefresh, handleLogout } from "./auth.refresh.js";
export {
  buildGoogleAuthorizationUrl,
  completeGoogleAuthorization,
} from "./auth.google.js";
