-- File: backend/src/prisma/migrations/20260617143000_move_nce_rls_helpers_to_app_schema/migration.sql
-- Purpose: Move NCE RLS helper functions out of the exposed public schema.
-- Why: Security-definer helpers are implementation details and must not be callable as authenticated Supabase RPCs.

CREATE SCHEMA IF NOT EXISTS app;

CREATE OR REPLACE FUNCTION app.nce_book_is_published(book_uuid UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.nce_books book
    WHERE book.id = book_uuid
      AND book.status = 'published'
      AND book.deleted_at IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION app.nce_unit_is_published(unit_uuid UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.nce_units unit
    WHERE unit.id = unit_uuid
      AND unit.status = 'published'
      AND unit.deleted_at IS NULL
      AND app.nce_book_is_published(unit.book_id)
  );
$$;

CREATE OR REPLACE FUNCTION app.nce_lesson_is_published(lesson_uuid UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.nce_lessons lesson
    WHERE lesson.id = lesson_uuid
      AND lesson.status = 'published'
      AND lesson.deleted_at IS NULL
      AND app.nce_unit_is_published(lesson.unit_id)
  );
$$;

REVOKE ALL ON FUNCTION app.nce_book_is_published(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.nce_unit_is_published(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.nce_lesson_is_published(UUID) FROM PUBLIC;

DROP POLICY IF EXISTS nce_units_select_published ON public.nce_units;
DROP POLICY IF EXISTS nce_lessons_select_published ON public.nce_lessons;
DROP POLICY IF EXISTS nce_objectives_select_published ON public.nce_objectives;
DROP POLICY IF EXISTS nce_exercises_select_published ON public.nce_exercises;

CREATE POLICY nce_units_select_published
ON public.nce_units
FOR SELECT
TO authenticated
USING (
  status = 'published'
  AND deleted_at IS NULL
  AND app.nce_book_is_published(book_id)
);

CREATE POLICY nce_lessons_select_published
ON public.nce_lessons
FOR SELECT
TO authenticated
USING (
  status = 'published'
  AND deleted_at IS NULL
  AND app.nce_unit_is_published(unit_id)
);

CREATE POLICY nce_objectives_select_published
ON public.nce_objectives
FOR SELECT
TO authenticated
USING (app.nce_lesson_is_published(lesson_id));

CREATE POLICY nce_exercises_select_published
ON public.nce_exercises
FOR SELECT
TO authenticated
USING (app.nce_lesson_is_published(lesson_id));

REVOKE ALL ON FUNCTION public.nce_book_is_published(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nce_unit_is_published(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nce_lesson_is_published(UUID) FROM PUBLIC;

DROP FUNCTION IF EXISTS public.nce_book_is_published(UUID);
DROP FUNCTION IF EXISTS public.nce_unit_is_published(UUID);
DROP FUNCTION IF EXISTS public.nce_lesson_is_published(UUID);
