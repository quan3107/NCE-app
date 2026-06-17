-- File: backend/src/prisma/migrations/20260617144000_inline_nce_rls_publish_checks/migration.sql
-- Purpose: Inline NCE published-chain checks in RLS policies.
-- Why: NCE policy helpers must not remain as authenticated security-definer functions.

GRANT SELECT (deleted_at) ON public.nce_books TO authenticated;
GRANT SELECT (deleted_at) ON public.nce_units TO authenticated;
GRANT SELECT (deleted_at) ON public.nce_lessons TO authenticated;

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
  AND EXISTS (
    SELECT 1
    FROM public.nce_books book
    WHERE book.id = nce_units.book_id
      AND book.status = 'published'
      AND book.deleted_at IS NULL
  )
);

CREATE POLICY nce_lessons_select_published
ON public.nce_lessons
FOR SELECT
TO authenticated
USING (
  status = 'published'
  AND deleted_at IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.nce_units unit
    JOIN public.nce_books book ON book.id = unit.book_id
    WHERE unit.id = nce_lessons.unit_id
      AND unit.status = 'published'
      AND unit.deleted_at IS NULL
      AND book.status = 'published'
      AND book.deleted_at IS NULL
  )
);

CREATE POLICY nce_objectives_select_published
ON public.nce_objectives
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.nce_lessons lesson
    JOIN public.nce_units unit ON unit.id = lesson.unit_id
    JOIN public.nce_books book ON book.id = unit.book_id
    WHERE lesson.id = nce_objectives.lesson_id
      AND lesson.status = 'published'
      AND lesson.deleted_at IS NULL
      AND unit.status = 'published'
      AND unit.deleted_at IS NULL
      AND book.status = 'published'
      AND book.deleted_at IS NULL
  )
);

CREATE POLICY nce_exercises_select_published
ON public.nce_exercises
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.nce_lessons lesson
    JOIN public.nce_units unit ON unit.id = lesson.unit_id
    JOIN public.nce_books book ON book.id = unit.book_id
    WHERE lesson.id = nce_exercises.lesson_id
      AND lesson.status = 'published'
      AND lesson.deleted_at IS NULL
      AND unit.status = 'published'
      AND unit.deleted_at IS NULL
      AND book.status = 'published'
      AND book.deleted_at IS NULL
  )
);

DO $$
BEGIN
  IF to_regprocedure('public.nce_book_is_published(uuid)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.nce_book_is_published(UUID) FROM PUBLIC;
  END IF;
  IF to_regprocedure('public.nce_unit_is_published(uuid)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.nce_unit_is_published(UUID) FROM PUBLIC;
  END IF;
  IF to_regprocedure('public.nce_lesson_is_published(uuid)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.nce_lesson_is_published(UUID) FROM PUBLIC;
  END IF;
  IF to_regprocedure('app.nce_book_is_published(uuid)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION app.nce_book_is_published(UUID) FROM PUBLIC;
  END IF;
  IF to_regprocedure('app.nce_unit_is_published(uuid)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION app.nce_unit_is_published(UUID) FROM PUBLIC;
  END IF;
  IF to_regprocedure('app.nce_lesson_is_published(uuid)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION app.nce_lesson_is_published(UUID) FROM PUBLIC;
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.nce_book_is_published(UUID);
DROP FUNCTION IF EXISTS public.nce_unit_is_published(UUID);
DROP FUNCTION IF EXISTS public.nce_lesson_is_published(UUID);
DROP FUNCTION IF EXISTS app.nce_book_is_published(UUID);
DROP FUNCTION IF EXISTS app.nce_unit_is_published(UUID);
DROP FUNCTION IF EXISTS app.nce_lesson_is_published(UUID);
