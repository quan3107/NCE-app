-- File: backend/src/prisma/migrations/20260213103000_add_notification_type_visual_metadata/migration.sql
-- Purpose: Add optional visual metadata fields for notification type configuration rows.
-- Why: Allows notification icon/accent semantics to be backend-driven instead of hardcoded in the frontend.

ALTER TABLE public.notification_type_configs
  ADD COLUMN IF NOT EXISTS icon TEXT,
  ADD COLUMN IF NOT EXISTS accent TEXT;

UPDATE public.notification_type_configs
SET icon = CASE type
  WHEN 'graded' THEN 'check-circle'
  WHEN 'due_soon' THEN 'clock'
  WHEN 'new_submission' THEN 'file-text'
  WHEN 'schedule_update' THEN 'clock'
  WHEN 'weekly_digest' THEN 'inbox'
  WHEN 'assignment_published' THEN 'file-text'
  ELSE 'bell'
END,
accent = CASE type
  WHEN 'graded' THEN 'success'
  WHEN 'due_soon' THEN 'warning'
  WHEN 'new_submission' THEN 'info'
  WHEN 'schedule_update' THEN 'info'
  WHEN 'weekly_digest' THEN 'neutral'
  ELSE 'info'
END
WHERE icon IS NULL OR accent IS NULL;
