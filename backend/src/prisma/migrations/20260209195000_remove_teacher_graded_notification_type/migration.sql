-- File: backend/src/prisma/migrations/20260209195000_remove_teacher_graded_notification_type/migration.sql
-- Purpose: Remove the teacher "graded" notification type from backend config rows.
-- Why: Teacher notification tabs should not show student-facing "graded" filter text.

DELETE FROM public.notification_type_configs
WHERE role = 'teacher'
  AND type = 'graded';

UPDATE public.notification_type_configs
SET sort_order = 2
WHERE role = 'teacher'
  AND type = 'reminder';

UPDATE public.notification_type_configs
SET sort_order = 3
WHERE role = 'teacher'
  AND type = 'weekly_digest';
