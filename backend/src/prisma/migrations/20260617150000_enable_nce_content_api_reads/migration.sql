-- File: backend/src/prisma/migrations/20260617150000_enable_nce_content_api_reads/migration.sql
-- Purpose: Align NCE content RLS with the server read API.
-- Why: Public catalog reads run as anon, while staff/server course reads need assignment metadata and restricted columns without exposing answer keys to normal authenticated clients.

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

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
) ON public.nce_books TO anon;

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
) ON public.nce_units TO anon;

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
) ON public.nce_lessons TO anon;

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
) ON public.nce_objectives TO anon;

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
) ON public.nce_exercises TO anon;

GRANT SELECT ON
  public.courses,
  public.enrollments
TO service_role;

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
) ON public.nce_books TO service_role;

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
) ON public.nce_units TO service_role;

GRANT SELECT (
  id,
  unit_id,
  lesson_number,
  title,
  lesson_text,
  media_json,
  teacher_notes,
  sort_order,
  status,
  published_at,
  created_at,
  updated_at,
  deleted_at
) ON public.nce_lessons TO service_role;

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
) ON public.nce_objectives TO service_role;

GRANT SELECT (
  id,
  lesson_id,
  objective_id,
  exercise_type,
  prompt,
  content,
  answer_key,
  scoring_config,
  sort_order,
  created_at,
  updated_at
) ON public.nce_exercises TO service_role;

GRANT SELECT (
  id,
  course_id,
  lesson_id,
  sequence,
  available_from,
  due_at,
  created_at,
  updated_at
) ON public.nce_course_lesson_assignments TO service_role;

ALTER POLICY nce_books_select_published
ON public.nce_books
TO anon, authenticated, service_role;

ALTER POLICY nce_units_select_published
ON public.nce_units
TO anon, authenticated, service_role;

ALTER POLICY nce_lessons_select_published
ON public.nce_lessons
TO anon, authenticated, service_role;

ALTER POLICY nce_objectives_select_published
ON public.nce_objectives
TO anon, authenticated, service_role;

ALTER POLICY nce_exercises_select_published
ON public.nce_exercises
TO anon, authenticated, service_role;

DROP POLICY IF EXISTS nce_course_lesson_assignments_deny_authenticated_select
ON public.nce_course_lesson_assignments;

CREATE POLICY nce_course_lesson_assignments_select_course_members
ON public.nce_course_lesson_assignments
FOR SELECT
TO service_role
USING (
  current_setting('app.current_user_role', true) = 'admin'
  OR EXISTS (
    SELECT 1
    FROM public.courses course
    WHERE course.id = nce_course_lesson_assignments.course_id
      AND course."deletedAt" IS NULL
      AND (
        course.owner_teacher_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
        OR EXISTS (
          SELECT 1
          FROM public.enrollments enrollment
          WHERE enrollment.course_id = course.id
            AND enrollment.user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
            AND enrollment."deletedAt" IS NULL
        )
      )
  )
);

CREATE POLICY nce_books_select_course_staff
ON public.nce_books
FOR SELECT
TO service_role
USING (
  current_setting('app.current_user_role', true) = 'admin'
  OR (
    current_setting('app.current_user_role', true) = 'teacher'
    AND EXISTS (
      SELECT 1
      FROM public.nce_units unit
      JOIN public.nce_lessons lesson ON lesson.unit_id = unit.id
      JOIN public.nce_course_lesson_assignments assignment ON assignment.lesson_id = lesson.id
      JOIN public.courses course ON course.id = assignment.course_id
      WHERE unit.book_id = nce_books.id
        AND unit.deleted_at IS NULL
        AND lesson.deleted_at IS NULL
        AND course."deletedAt" IS NULL
        AND (
          course.owner_teacher_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
          OR EXISTS (
            SELECT 1
            FROM public.enrollments enrollment
            WHERE enrollment.course_id = course.id
              AND enrollment.user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
              AND enrollment.role_in_course = 'teacher'
              AND enrollment."deletedAt" IS NULL
          )
        )
    )
  )
);

CREATE POLICY nce_units_select_course_staff
ON public.nce_units
FOR SELECT
TO service_role
USING (
  current_setting('app.current_user_role', true) = 'admin'
  OR (
    current_setting('app.current_user_role', true) = 'teacher'
    AND EXISTS (
      SELECT 1
      FROM public.nce_lessons lesson
      JOIN public.nce_course_lesson_assignments assignment ON assignment.lesson_id = lesson.id
      JOIN public.courses course ON course.id = assignment.course_id
      WHERE lesson.unit_id = nce_units.id
        AND lesson.deleted_at IS NULL
        AND course."deletedAt" IS NULL
        AND (
          course.owner_teacher_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
          OR EXISTS (
            SELECT 1
            FROM public.enrollments enrollment
            WHERE enrollment.course_id = course.id
              AND enrollment.user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
              AND enrollment.role_in_course = 'teacher'
              AND enrollment."deletedAt" IS NULL
          )
        )
    )
  )
);

CREATE POLICY nce_lessons_select_course_staff
ON public.nce_lessons
FOR SELECT
TO service_role
USING (
  current_setting('app.current_user_role', true) = 'admin'
  OR (
    current_setting('app.current_user_role', true) = 'teacher'
    AND EXISTS (
      SELECT 1
      FROM public.nce_course_lesson_assignments assignment
      JOIN public.courses course ON course.id = assignment.course_id
      WHERE assignment.lesson_id = nce_lessons.id
        AND course."deletedAt" IS NULL
        AND (
          course.owner_teacher_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
          OR EXISTS (
            SELECT 1
            FROM public.enrollments enrollment
            WHERE enrollment.course_id = course.id
              AND enrollment.user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
              AND enrollment.role_in_course = 'teacher'
              AND enrollment."deletedAt" IS NULL
          )
        )
    )
  )
);

CREATE POLICY nce_objectives_select_course_staff
ON public.nce_objectives
FOR SELECT
TO service_role
USING (
  current_setting('app.current_user_role', true) = 'admin'
  OR (
    current_setting('app.current_user_role', true) = 'teacher'
    AND EXISTS (
      SELECT 1
      FROM public.nce_course_lesson_assignments assignment
      JOIN public.courses course ON course.id = assignment.course_id
      WHERE assignment.lesson_id = nce_objectives.lesson_id
        AND course."deletedAt" IS NULL
        AND (
          course.owner_teacher_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
          OR EXISTS (
            SELECT 1
            FROM public.enrollments enrollment
            WHERE enrollment.course_id = course.id
              AND enrollment.user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
              AND enrollment.role_in_course = 'teacher'
              AND enrollment."deletedAt" IS NULL
          )
        )
    )
  )
);

CREATE POLICY nce_exercises_select_course_staff
ON public.nce_exercises
FOR SELECT
TO service_role
USING (
  current_setting('app.current_user_role', true) = 'admin'
  OR (
    current_setting('app.current_user_role', true) = 'teacher'
    AND EXISTS (
      SELECT 1
      FROM public.nce_course_lesson_assignments assignment
      JOIN public.courses course ON course.id = assignment.course_id
      WHERE assignment.lesson_id = nce_exercises.lesson_id
        AND course."deletedAt" IS NULL
        AND (
          course.owner_teacher_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
          OR EXISTS (
            SELECT 1
            FROM public.enrollments enrollment
            WHERE enrollment.course_id = course.id
              AND enrollment.user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
              AND enrollment.role_in_course = 'teacher'
              AND enrollment."deletedAt" IS NULL
          )
        )
    )
  )
);
