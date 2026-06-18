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
