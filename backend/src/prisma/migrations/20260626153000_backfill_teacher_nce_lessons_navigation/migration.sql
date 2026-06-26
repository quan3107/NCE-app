-- File: backend/src/prisma/migrations/20260626153000_backfill_teacher_nce_lessons_navigation/migration.sql
-- Purpose: Backfill teacher NCE lesson navigation for already-deployed databases.
-- Why: Authenticated navigation is backend-driven, so missing rows hide the teacher NCE authoring route.

WITH courses_manage_permission AS (
  INSERT INTO public.permissions (key, name)
  VALUES ('courses:manage', 'Manage Courses')
  ON CONFLICT (key) DO UPDATE
    SET name = EXCLUDED.name
  RETURNING id
)
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'teacher', id
FROM courses_manage_permission
ON CONFLICT DO NOTHING;

UPDATE public.navigation_items
SET order_index = order_index + 1,
    "updatedAt" = NOW()
WHERE role = 'teacher'
  AND order_index >= 5
  AND NOT EXISTS (
    SELECT 1
    FROM public.navigation_items existing
    WHERE existing.role = 'teacher'
      AND existing.path = '/teacher/nce-lessons'
  );

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
  'teacher',
  'NCE Lessons',
  '/teacher/nce-lessons',
  'book-open',
  'courses:manage',
  5,
  NULL,
  NULL,
  TRUE,
  NULL
WHERE NOT EXISTS (
  SELECT 1
  FROM public.navigation_items
  WHERE role = 'teacher'
    AND path = '/teacher/nce-lessons'
);
