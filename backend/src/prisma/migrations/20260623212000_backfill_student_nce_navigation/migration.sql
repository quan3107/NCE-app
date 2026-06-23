-- File: backend/src/prisma/migrations/20260623212000_backfill_student_nce_navigation/migration.sql
-- Purpose: Backfill student NCE navigation for already-deployed databases.
-- Why: Existing live navigation rows override frontend fallback navigation.

WITH courses_permission AS (
  INSERT INTO public.permissions (key, name)
  VALUES ('courses:read', 'Read Courses')
  ON CONFLICT (key) DO UPDATE
    SET name = EXCLUDED.name
  RETURNING id
)
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'student', id
FROM courses_permission
ON CONFLICT DO NOTHING;

UPDATE public.navigation_items
SET order_index = order_index + 1,
    "updatedAt" = NOW()
WHERE role = 'student'
  AND order_index >= 2
  AND NOT EXISTS (
    SELECT 1
    FROM public.navigation_items existing
    WHERE existing.role = 'student'
      AND existing.path = '/student/nce'
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
  'student',
  'NCE Path',
  '/student/nce',
  'book-open',
  'courses:read',
  2,
  NULL,
  NULL,
  TRUE,
  NULL
WHERE NOT EXISTS (
  SELECT 1
  FROM public.navigation_items
  WHERE role = 'student'
    AND path = '/student/nce'
);
