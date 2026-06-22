-- File: backend/src/prisma/migrations/20260622152000_grant_navigation_runtime_reads/migration.sql
-- Purpose: Grant runtime roles table-level read access for navigation/config hydration.
-- Why: RLS policies filter rows, but authenticated and service_role need SELECT grants before those policies can run.

GRANT SELECT ON public.navigation_items TO authenticated, service_role;
GRANT SELECT ON public.permissions TO authenticated, service_role;
GRANT SELECT ON public.role_permissions TO authenticated, service_role;
GRANT SELECT ON public.feature_flags TO authenticated, service_role;
GRANT SELECT ON public.feature_flag_roles TO authenticated, service_role;
