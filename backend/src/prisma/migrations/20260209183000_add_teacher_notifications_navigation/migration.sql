-- File: backend/src/prisma/migrations/20260209183000_add_teacher_notifications_navigation/migration.sql
-- Purpose: Add a teacher notifications navigation item to existing environments.
-- Why: Teachers need a backend-driven menu entry to access the notifications UI.

-- Shift existing teacher items so Notifications can occupy order index 4.
UPDATE public.navigation_items
SET order_index = 5
WHERE role = 'teacher'
  AND path = '/teacher/rubrics'
  AND parent_id IS NULL;

UPDATE public.navigation_items
SET order_index = 6
WHERE role = 'teacher'
  AND path = '/teacher/analytics'
  AND parent_id IS NULL;

UPDATE public.navigation_items
SET order_index = 7
WHERE role = 'teacher'
  AND path = '/teacher/profile'
  AND parent_id IS NULL;

-- Insert the item when it does not already exist for the teacher role.
INSERT INTO public.navigation_items (
  id,
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
  gen_random_uuid(),
  'teacher',
  'Notifications',
  '/teacher/notifications',
  'bell',
  'notifications:read',
  4,
  'notifications',
  NULL,
  TRUE,
  NULL
WHERE NOT EXISTS (
  SELECT 1
  FROM public.navigation_items
  WHERE role = 'teacher'
    AND path = '/teacher/notifications'
    AND parent_id IS NULL
);

-- Keep existing rows aligned with current default values if they already exist.
UPDATE public.navigation_items
SET label = 'Notifications',
    icon_name = 'bell',
    required_permission = 'notifications:read',
    order_index = 4,
    badge_source = 'notifications',
    is_active = TRUE,
    feature_flag = NULL
WHERE role = 'teacher'
  AND path = '/teacher/notifications'
  AND parent_id IS NULL;
