-- File: backend/src/prisma/migrations/20260617140000_secure_nce_content_access/migration.sql
-- Purpose: Secure Supabase Data API access for NCE content tables.
-- Why: Authenticated clients can read published student content, but never drafts, archived rows, answer keys, or course mappings.

REVOKE SELECT ON public.nce_books FROM anon;
REVOKE SELECT ON public.nce_units FROM anon;
REVOKE SELECT ON public.nce_lessons FROM anon;
REVOKE SELECT ON public.nce_objectives FROM anon;
REVOKE SELECT ON public.nce_exercises FROM anon;
REVOKE SELECT ON public.nce_course_lesson_assignments FROM anon;

REVOKE SELECT ON public.nce_books FROM authenticated;
REVOKE SELECT ON public.nce_units FROM authenticated;
REVOKE SELECT ON public.nce_lessons FROM authenticated;
REVOKE SELECT ON public.nce_objectives FROM authenticated;
REVOKE SELECT ON public.nce_exercises FROM authenticated;
REVOKE SELECT ON public.nce_course_lesson_assignments FROM authenticated;

ALTER TABLE public.nce_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nce_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nce_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nce_objectives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nce_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nce_course_lesson_assignments ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.nce_books FORCE ROW LEVEL SECURITY;
ALTER TABLE public.nce_units FORCE ROW LEVEL SECURITY;
ALTER TABLE public.nce_lessons FORCE ROW LEVEL SECURITY;
ALTER TABLE public.nce_objectives FORCE ROW LEVEL SECURITY;
ALTER TABLE public.nce_exercises FORCE ROW LEVEL SECURITY;
ALTER TABLE public.nce_course_lesson_assignments FORCE ROW LEVEL SECURITY;

GRANT SELECT (
  id,
  code,
  title,
  level,
  description,
  sort_order,
  status,
  published_at,
  created_at,
  updated_at
) ON public.nce_books TO authenticated;

GRANT SELECT (
  id,
  book_id,
  unit_number,
  title,
  description,
  sort_order,
  status,
  published_at,
  created_at,
  updated_at
) ON public.nce_units TO authenticated;

GRANT SELECT (
  id,
  unit_id,
  lesson_number,
  title,
  lesson_text,
  media_json,
  sort_order,
  status,
  published_at,
  created_at,
  updated_at
) ON public.nce_lessons TO authenticated;

GRANT SELECT (
  id,
  lesson_id,
  code,
  title,
  category,
  description,
  mastery_threshold,
  sort_order,
  created_at,
  updated_at
) ON public.nce_objectives TO authenticated;

GRANT SELECT (
  id,
  lesson_id,
  objective_id,
  exercise_type,
  prompt,
  content,
  scoring_config,
  sort_order,
  created_at,
  updated_at
) ON public.nce_exercises TO authenticated;

CREATE POLICY nce_books_select_published
ON public.nce_books
FOR SELECT
TO authenticated
USING (
  status = 'published'
  AND deleted_at IS NULL
);

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
