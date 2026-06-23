-- File: backend/src/prisma/migrations/20260623175000_add_nce_attempts/migration.sql
-- Purpose: Add NCE lesson progress and exercise attempt persistence.
-- Why: Student NCE learning needs durable drafts, submissions, scores, and completion state.

CREATE TYPE public."NceAttemptStatus" AS ENUM ('draft', 'submitted');
CREATE TYPE public."NceLessonProgressStatus" AS ENUM ('in_progress', 'completed');

CREATE TABLE public.nce_lesson_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES public.nce_lessons(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status public."NceLessonProgressStatus" NOT NULL DEFAULT 'in_progress',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.nce_exercise_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES public.nce_lessons(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES public.nce_exercises(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status public."NceAttemptStatus" NOT NULL DEFAULT 'draft',
  response JSONB NOT NULL,
  score INTEGER,
  max_score INTEGER,
  feedback_json JSONB,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX nce_lesson_progress_course_lesson_student_key
  ON public.nce_lesson_progress(course_id, lesson_id, student_id);

CREATE INDEX nce_lesson_progress_student_status_updated_idx
  ON public.nce_lesson_progress(student_id, status, updated_at);

CREATE INDEX nce_lesson_progress_course_lesson_status_idx
  ON public.nce_lesson_progress(course_id, lesson_id, status);

CREATE INDEX nce_attempts_course_student_status_updated_idx
  ON public.nce_exercise_attempts(course_id, student_id, status, updated_at);

CREATE INDEX nce_attempts_exercise_student_status_idx
  ON public.nce_exercise_attempts(exercise_id, student_id, status);

CREATE INDEX nce_attempts_lesson_student_submitted_idx
  ON public.nce_exercise_attempts(lesson_id, student_id, submitted_at);

ALTER TABLE public.nce_lesson_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nce_exercise_attempts ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.nce_lesson_progress TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.nce_exercise_attempts TO service_role;

CREATE POLICY nce_lesson_progress_service_role_all
ON public.nce_lesson_progress
FOR ALL
TO service_role
USING (current_role = 'service_role')
WITH CHECK (current_role = 'service_role');

CREATE POLICY nce_exercise_attempts_service_role_all
ON public.nce_exercise_attempts
FOR ALL
TO service_role
USING (current_role = 'service_role')
WITH CHECK (current_role = 'service_role');
