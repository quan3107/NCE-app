-- File: backend/src/prisma/migrations/20260617120000_add_nce_content/migration.sql
-- Purpose: Add first-class NCE content tables and course lesson mapping.
-- Why: The product needs native NCE books, units, lessons, objectives, exercises, answer keys, and publish state.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NcePublishStatus') THEN
    CREATE TYPE "NcePublishStatus" AS ENUM ('draft', 'published', 'archived');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NceExerciseType') THEN
    CREATE TYPE "NceExerciseType" AS ENUM (
      'vocabulary',
      'grammar',
      'listening',
      'speaking',
      'reading',
      'writing',
      'translation',
      'dictation',
      'multiple_choice',
      'gap_fill'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.nce_books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  level TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  status "NcePublishStatus" NOT NULL DEFAULT 'draft',
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT nce_books_code_key UNIQUE (code)
);

CREATE TABLE IF NOT EXISTS public.nce_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES public.nce_books(id) ON DELETE CASCADE,
  unit_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  status "NcePublishStatus" NOT NULL DEFAULT 'draft',
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT nce_units_book_id_unit_number_key UNIQUE (book_id, unit_number)
);

CREATE TABLE IF NOT EXISTS public.nce_lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID NOT NULL REFERENCES public.nce_units(id) ON DELETE CASCADE,
  lesson_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  lesson_text TEXT NOT NULL,
  media_json JSONB,
  teacher_notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  status "NcePublishStatus" NOT NULL DEFAULT 'draft',
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT nce_lessons_unit_id_lesson_number_key UNIQUE (unit_id, lesson_number)
);

CREATE TABLE IF NOT EXISTS public.nce_objectives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES public.nce_lessons(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  mastery_threshold INTEGER NOT NULL DEFAULT 80,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT nce_objectives_lesson_id_code_key UNIQUE (lesson_id, code),
  CONSTRAINT nce_objectives_mastery_threshold_check
    CHECK (mastery_threshold BETWEEN 0 AND 100)
);

CREATE TABLE IF NOT EXISTS public.nce_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES public.nce_lessons(id) ON DELETE CASCADE,
  objective_id UUID REFERENCES public.nce_objectives(id) ON DELETE SET NULL,
  exercise_type "NceExerciseType" NOT NULL,
  prompt TEXT NOT NULL,
  content JSONB NOT NULL,
  answer_key JSONB NOT NULL,
  scoring_config JSONB,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT nce_exercises_lesson_type_sort_key
    UNIQUE (lesson_id, exercise_type, sort_order)
);

CREATE TABLE IF NOT EXISTS public.nce_course_lesson_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES public.nce_lessons(id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL,
  available_from TIMESTAMPTZ,
  due_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT nce_course_lesson_course_lesson_key UNIQUE (course_id, lesson_id),
  CONSTRAINT nce_course_lesson_course_sequence_key UNIQUE (course_id, sequence)
);

CREATE INDEX IF NOT EXISTS nce_books_status_sort_idx
  ON public.nce_books(status, sort_order);
CREATE INDEX IF NOT EXISTS nce_units_book_status_sort_idx
  ON public.nce_units(book_id, status, sort_order);
CREATE INDEX IF NOT EXISTS nce_lessons_unit_status_sort_idx
  ON public.nce_lessons(unit_id, status, sort_order);
CREATE INDEX IF NOT EXISTS nce_objectives_lesson_category_sort_idx
  ON public.nce_objectives(lesson_id, category, sort_order);
CREATE INDEX IF NOT EXISTS nce_exercises_objective_id_idx
  ON public.nce_exercises(objective_id);
CREATE INDEX IF NOT EXISTS nce_course_lesson_lesson_id_idx
  ON public.nce_course_lesson_assignments(lesson_id);

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
  updated_at,
  deleted_at
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
  updated_at,
  deleted_at
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
  updated_at,
  deleted_at
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

CREATE POLICY nce_course_lesson_assignments_deny_authenticated_select
ON public.nce_course_lesson_assignments
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (false);
