-- File: backend/src/prisma/migrations/20260206020000_add_app_course_helper_functions/migration.sql
-- Purpose: Define app helper functions used by public.courses_public view.
-- Why: Later migrations reference app.course_owner_name/course_metrics and must work in shadow replay.
-- Note: Uses CREATE OR REPLACE for safe re-application.

CREATE SCHEMA IF NOT EXISTS app;

CREATE OR REPLACE FUNCTION app.course_owner_name(course_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT u.full_name
  FROM public.courses c
  JOIN public.users u ON u.id = c.owner_teacher_id
  WHERE c.id = $1
    AND c."deletedAt" IS NULL
    AND u."deletedAt" IS NULL;
$function$;

CREATE OR REPLACE FUNCTION app.course_metrics(course_id uuid)
RETURNS TABLE(
  active_student_count integer,
  invited_student_count integer,
  teacher_count integer,
  assignment_count integer,
  rubric_count integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    count(*) FILTER (
      WHERE e.role_in_course = 'student'
        AND u.status IS NOT NULL
        AND u.status <> 'invited'
    )::int AS active_student_count,
    count(*) FILTER (
      WHERE e.role_in_course = 'student'
        AND u.status = 'invited'
    )::int AS invited_student_count,
    count(*) FILTER (
      WHERE e.role_in_course = 'teacher'
    )::int AS teacher_count,
    (
      SELECT count(*)::int
      FROM public.assignments a
      WHERE a.course_id = $1
        AND a."deletedAt" IS NULL
    ) AS assignment_count,
    (
      SELECT count(*)::int
      FROM public.rubrics r
      WHERE r.course_id = $1
        AND r."deletedAt" IS NULL
    ) AS rubric_count
  FROM public.enrollments e
  LEFT JOIN public.users u ON u.id = e.user_id AND u."deletedAt" IS NULL
  WHERE e.course_id = $1
    AND e."deletedAt" IS NULL;
$function$;
