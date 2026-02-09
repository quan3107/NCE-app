-- File: backend/src/prisma/migrations/20260209110000_add_notification_type_configs/migration.sql
-- Purpose: Add role-based notification type metadata for config-driven frontend filters.
-- Why: Replaces hardcoded notification type lists with backend-managed configuration.

CREATE TABLE IF NOT EXISTS public.notification_type_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role "UserRole" NOT NULL,
  type TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'general',
  default_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT notification_type_cfg_role_type_key UNIQUE (role, type)
);

CREATE INDEX IF NOT EXISTS notification_type_cfg_role_enabled_sort_idx
  ON public.notification_type_configs(role, enabled, sort_order);

-- Baseline notification types by role.
INSERT INTO public.notification_type_configs (
  role,
  type,
  label,
  description,
  category,
  default_enabled,
  enabled,
  sort_order
)
VALUES
  ('student'::"UserRole", 'assignment_published', 'Assignment Published', 'When a new assignment is published.', 'assignments', TRUE, TRUE, 1),
  ('student'::"UserRole", 'due_soon', 'Due Soon', 'When an assignment deadline is approaching.', 'assignments', TRUE, TRUE, 2),
  ('student'::"UserRole", 'graded', 'Graded', 'When feedback and scores are released.', 'grading', TRUE, TRUE, 3),
  ('student'::"UserRole", 'reminder', 'Reminder', 'General reminders and nudges.', 'general', TRUE, TRUE, 4),
  ('student'::"UserRole", 'weekly_digest', 'Weekly Digest', 'A weekly summary of upcoming coursework.', 'digest', TRUE, TRUE, 5),
  ('teacher'::"UserRole", 'new_submission', 'New Submission', 'When a student submits new work.', 'grading', TRUE, TRUE, 1),
  ('teacher'::"UserRole", 'graded', 'Graded', 'When grading activity is completed.', 'grading', TRUE, TRUE, 2),
  ('teacher'::"UserRole", 'reminder', 'Reminder', 'General reminders and workflow nudges.', 'general', TRUE, TRUE, 3),
  ('teacher'::"UserRole", 'weekly_digest', 'Weekly Digest', 'A weekly summary of assignment activity.', 'digest', TRUE, TRUE, 4),
  ('admin'::"UserRole", 'reminder', 'Reminder', 'General operational reminders.', 'general', TRUE, TRUE, 1),
  ('admin'::"UserRole", 'weekly_digest', 'Weekly Digest', 'A weekly platform activity summary.', 'digest', TRUE, TRUE, 2),
  ('admin'::"UserRole", 'schedule_update', 'Schedule Update', 'When class schedules or events are updated.', 'system', TRUE, TRUE, 3)
ON CONFLICT (role, type)
DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  default_enabled = EXCLUDED.default_enabled,
  enabled = EXCLUDED.enabled,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();

GRANT SELECT ON public.notification_type_configs TO authenticated;
