-- File: backend/src/prisma/migrations/20260729170000_add_admin_profile_navigation/migration.sql
-- Purpose: Backfill the admin Profile navigation item on existing deployments.
-- Why: Backend-driven menus must expose the already-routable admin profile page after migrate deploy.

INSERT INTO public.navigation_items (
  role,
  label,
  path,
  icon_name,
  required_permission,
  order_index,
  badge_source,
  parent_id,
  is_active,
  feature_flag
)
SELECT
  'admin',
  'Profile',
  '/admin/profile',
  'user',
  'profile:view',
  7,
  NULL,
  NULL,
  TRUE,
  NULL
WHERE NOT EXISTS (
  SELECT 1
  FROM public.navigation_items
  WHERE role = 'admin'
    AND path = '/admin/profile'
);
