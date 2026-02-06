-- File: backend/src/prisma/migrations/20260206031000_grant_service_role_users_for_auth/migration.sql
-- Purpose: Grant service_role access required by backend auth workflows.
-- Why: Password/Google login and refresh query/update users under runWithRole(service_role).
-- Note: Re-running GRANT statements is safe and idempotent.

GRANT SELECT, INSERT, UPDATE ON public.users TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.auth_sessions TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.identities TO service_role;
