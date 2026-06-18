-- File: backend/src/prisma/migrations/20260618162000_scope_nce_lessons_to_courses/migration.sql
-- Purpose: Scope teacher-authored NCE lessons to a course without blocking canonical lesson numbers.
-- Why: Course assignment should not grant edit access to global NCE lessons.

ALTER TABLE public.nce_lessons
  ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE;

ALTER TABLE public.nce_lessons
  DROP CONSTRAINT IF EXISTS nce_lessons_unit_id_lesson_number_key;

CREATE UNIQUE INDEX IF NOT EXISTS nce_lessons_global_unit_number_key
  ON public.nce_lessons(unit_id, lesson_number)
  WHERE course_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS nce_lessons_course_unit_number_key
  ON public.nce_lessons(course_id, unit_id, lesson_number)
  WHERE course_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS nce_lessons_course_unit_number_idx
  ON public.nce_lessons(course_id, unit_id, lesson_number);

DROP POLICY IF EXISTS nce_lessons_select_published ON public.nce_lessons;

CREATE POLICY nce_lessons_select_published
ON public.nce_lessons
FOR SELECT
TO anon, authenticated, service_role
USING (
  status = 'published'
  AND deleted_at IS NULL
  AND course_id IS NULL
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

DROP POLICY IF EXISTS nce_objectives_select_published ON public.nce_objectives;

CREATE POLICY nce_objectives_select_published
ON public.nce_objectives
FOR SELECT
TO anon, authenticated, service_role
USING (
  EXISTS (
    SELECT 1
    FROM public.nce_lessons lesson
    JOIN public.nce_units unit ON unit.id = lesson.unit_id
    JOIN public.nce_books book ON book.id = unit.book_id
    WHERE lesson.id = nce_objectives.lesson_id
      AND lesson.status = 'published'
      AND lesson.deleted_at IS NULL
      AND lesson.course_id IS NULL
      AND unit.status = 'published'
      AND unit.deleted_at IS NULL
      AND book.status = 'published'
      AND book.deleted_at IS NULL
  )
);

DROP POLICY IF EXISTS nce_exercises_select_published ON public.nce_exercises;

CREATE POLICY nce_exercises_select_published
ON public.nce_exercises
FOR SELECT
TO anon, authenticated, service_role
USING (
  EXISTS (
    SELECT 1
    FROM public.nce_lessons lesson
    JOIN public.nce_units unit ON unit.id = lesson.unit_id
    JOIN public.nce_books book ON book.id = unit.book_id
    WHERE lesson.id = nce_exercises.lesson_id
      AND lesson.status = 'published'
      AND lesson.deleted_at IS NULL
      AND lesson.course_id IS NULL
      AND unit.status = 'published'
      AND unit.deleted_at IS NULL
      AND book.status = 'published'
      AND book.deleted_at IS NULL
  )
);
