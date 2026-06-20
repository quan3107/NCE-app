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

GRANT SELECT (course_id) ON public.nce_lessons TO anon, authenticated, service_role;

GRANT INSERT, UPDATE, DELETE ON public.nce_lessons TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.nce_objectives TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.nce_exercises TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.nce_course_lesson_assignments TO service_role;

DROP POLICY IF EXISTS nce_lessons_select_published ON public.nce_lessons;
DROP POLICY IF EXISTS nce_lessons_select_published_course_members ON public.nce_lessons;

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

CREATE POLICY nce_lessons_select_published_course_members
ON public.nce_lessons
FOR SELECT
TO service_role
USING (
  status = 'published'
  AND deleted_at IS NULL
  AND course_id IS NOT NULL
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
  AND EXISTS (
    SELECT 1
    FROM public.nce_course_lesson_assignments assignment
    JOIN public.courses course ON course.id = assignment.course_id
    WHERE assignment.lesson_id = nce_lessons.id
      AND assignment.course_id = nce_lessons.course_id
      AND course."deletedAt" IS NULL
      AND (
        current_setting('app.current_user_role', true) = 'admin'
        OR course.owner_teacher_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
        OR EXISTS (
          SELECT 1
          FROM public.enrollments enrollment
          WHERE enrollment.course_id = course.id
            AND enrollment.user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
            AND enrollment.role_in_course IN ('teacher', 'student')
            AND enrollment."deletedAt" IS NULL
        )
      )
  )
);

DROP POLICY IF EXISTS nce_lessons_service_role_insert ON public.nce_lessons;

CREATE POLICY nce_lessons_service_role_insert
ON public.nce_lessons
FOR INSERT
TO service_role
WITH CHECK (current_role = 'service_role');

DROP POLICY IF EXISTS nce_lessons_service_role_update ON public.nce_lessons;

CREATE POLICY nce_lessons_service_role_update
ON public.nce_lessons
FOR UPDATE
TO service_role
USING (current_role = 'service_role')
WITH CHECK (current_role = 'service_role');

DROP POLICY IF EXISTS nce_lessons_service_role_delete ON public.nce_lessons;

CREATE POLICY nce_lessons_service_role_delete
ON public.nce_lessons
FOR DELETE
TO service_role
USING (current_role = 'service_role');

DROP POLICY IF EXISTS nce_objectives_service_role_insert ON public.nce_objectives;

CREATE POLICY nce_objectives_service_role_insert
ON public.nce_objectives
FOR INSERT
TO service_role
WITH CHECK (current_role = 'service_role');

DROP POLICY IF EXISTS nce_objectives_service_role_update ON public.nce_objectives;

CREATE POLICY nce_objectives_service_role_update
ON public.nce_objectives
FOR UPDATE
TO service_role
USING (current_role = 'service_role')
WITH CHECK (current_role = 'service_role');

DROP POLICY IF EXISTS nce_objectives_service_role_delete ON public.nce_objectives;

CREATE POLICY nce_objectives_service_role_delete
ON public.nce_objectives
FOR DELETE
TO service_role
USING (current_role = 'service_role');

DROP POLICY IF EXISTS nce_exercises_service_role_insert ON public.nce_exercises;

CREATE POLICY nce_exercises_service_role_insert
ON public.nce_exercises
FOR INSERT
TO service_role
WITH CHECK (current_role = 'service_role');

DROP POLICY IF EXISTS nce_exercises_service_role_update ON public.nce_exercises;

CREATE POLICY nce_exercises_service_role_update
ON public.nce_exercises
FOR UPDATE
TO service_role
USING (current_role = 'service_role')
WITH CHECK (current_role = 'service_role');

DROP POLICY IF EXISTS nce_exercises_service_role_delete ON public.nce_exercises;

CREATE POLICY nce_exercises_service_role_delete
ON public.nce_exercises
FOR DELETE
TO service_role
USING (current_role = 'service_role');

DROP POLICY IF EXISTS nce_course_lesson_assignments_service_role_insert
ON public.nce_course_lesson_assignments;

CREATE POLICY nce_course_lesson_assignments_service_role_insert
ON public.nce_course_lesson_assignments
FOR INSERT
TO service_role
WITH CHECK (current_role = 'service_role');

DROP POLICY IF EXISTS nce_course_lesson_assignments_service_role_update
ON public.nce_course_lesson_assignments;

CREATE POLICY nce_course_lesson_assignments_service_role_update
ON public.nce_course_lesson_assignments
FOR UPDATE
TO service_role
USING (current_role = 'service_role')
WITH CHECK (current_role = 'service_role');

DROP POLICY IF EXISTS nce_course_lesson_assignments_service_role_delete
ON public.nce_course_lesson_assignments;

CREATE POLICY nce_course_lesson_assignments_service_role_delete
ON public.nce_course_lesson_assignments
FOR DELETE
TO service_role
USING (current_role = 'service_role');

DROP POLICY IF EXISTS nce_objectives_select_published ON public.nce_objectives;
DROP POLICY IF EXISTS nce_objectives_select_published_course_members
ON public.nce_objectives;

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

CREATE POLICY nce_objectives_select_published_course_members
ON public.nce_objectives
FOR SELECT
TO service_role
USING (
  EXISTS (
    SELECT 1
    FROM public.nce_lessons lesson
    JOIN public.nce_units unit ON unit.id = lesson.unit_id
    JOIN public.nce_books book ON book.id = unit.book_id
    JOIN public.nce_course_lesson_assignments assignment
      ON assignment.lesson_id = lesson.id
    JOIN public.courses course ON course.id = assignment.course_id
    WHERE lesson.id = nce_objectives.lesson_id
      AND lesson.status = 'published'
      AND lesson.deleted_at IS NULL
      AND lesson.course_id IS NOT NULL
      AND assignment.course_id = lesson.course_id
      AND unit.status = 'published'
      AND unit.deleted_at IS NULL
      AND book.status = 'published'
      AND book.deleted_at IS NULL
      AND course."deletedAt" IS NULL
      AND (
        current_setting('app.current_user_role', true) = 'admin'
        OR course.owner_teacher_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
        OR EXISTS (
          SELECT 1
          FROM public.enrollments enrollment
          WHERE enrollment.course_id = course.id
            AND enrollment.user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
            AND enrollment.role_in_course IN ('teacher', 'student')
            AND enrollment."deletedAt" IS NULL
        )
      )
  )
);

DROP POLICY IF EXISTS nce_exercises_select_published ON public.nce_exercises;
DROP POLICY IF EXISTS nce_exercises_select_published_course_members
ON public.nce_exercises;

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

CREATE POLICY nce_exercises_select_published_course_members
ON public.nce_exercises
FOR SELECT
TO service_role
USING (
  EXISTS (
    SELECT 1
    FROM public.nce_lessons lesson
    JOIN public.nce_units unit ON unit.id = lesson.unit_id
    JOIN public.nce_books book ON book.id = unit.book_id
    JOIN public.nce_course_lesson_assignments assignment
      ON assignment.lesson_id = lesson.id
    JOIN public.courses course ON course.id = assignment.course_id
    WHERE lesson.id = nce_exercises.lesson_id
      AND lesson.status = 'published'
      AND lesson.deleted_at IS NULL
      AND lesson.course_id IS NOT NULL
      AND assignment.course_id = lesson.course_id
      AND unit.status = 'published'
      AND unit.deleted_at IS NULL
      AND book.status = 'published'
      AND book.deleted_at IS NULL
      AND course."deletedAt" IS NULL
      AND (
        current_setting('app.current_user_role', true) = 'admin'
        OR course.owner_teacher_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
        OR EXISTS (
          SELECT 1
          FROM public.enrollments enrollment
          WHERE enrollment.course_id = course.id
            AND enrollment.user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
            AND enrollment.role_in_course IN ('teacher', 'student')
            AND enrollment."deletedAt" IS NULL
        )
      )
  )
);
