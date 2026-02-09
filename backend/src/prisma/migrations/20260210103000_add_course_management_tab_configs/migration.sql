-- File: backend/src/prisma/migrations/20260210103000_add_course_management_tab_configs/migration.sql
-- Purpose: Add role-based course management tab configuration.
-- Why: Replaces hardcoded teacher course tab definitions with backend-managed config.

CREATE TABLE IF NOT EXISTS public.course_management_tab_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role "UserRole" NOT NULL,
  tab_id TEXT NOT NULL,
  label TEXT NOT NULL,
  icon TEXT NOT NULL,
  required_permission TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT course_mgmt_tab_cfg_role_tab_key UNIQUE (role, tab_id)
);

CREATE INDEX IF NOT EXISTS course_mgmt_tab_cfg_role_enabled_sort_idx
  ON public.course_management_tab_configs(role, enabled, sort_order);

-- Baseline teacher course-management tabs.
INSERT INTO public.course_management_tab_configs (
  role,
  tab_id,
  label,
  icon,
  required_permission,
  sort_order,
  enabled
)
VALUES
  ('teacher'::"UserRole", 'overview', 'Overview', 'book-open', 'courses:read', 1, TRUE),
  ('teacher'::"UserRole", 'students', 'Students', 'users', 'courses:manage', 2, TRUE),
  ('teacher'::"UserRole", 'deadlines', 'Deadlines', 'clock', 'assignments:create', 3, TRUE),
  ('teacher'::"UserRole", 'announcements', 'Announcements', 'megaphone', 'courses:manage', 4, TRUE),
  ('teacher'::"UserRole", 'settings', 'Settings', 'settings', 'rubrics:manage', 5, TRUE)
ON CONFLICT (role, tab_id)
DO UPDATE SET
  label = EXCLUDED.label,
  icon = EXCLUDED.icon,
  required_permission = EXCLUDED.required_permission,
  sort_order = EXCLUDED.sort_order,
  enabled = EXCLUDED.enabled,
  updated_at = NOW();

GRANT SELECT ON public.course_management_tab_configs TO authenticated;
