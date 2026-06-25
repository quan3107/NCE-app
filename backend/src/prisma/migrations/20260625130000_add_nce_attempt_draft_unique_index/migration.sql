-- File: backend/src/prisma/migrations/20260625130000_add_nce_attempt_draft_unique_index/migration.sql
-- Purpose: Enforce one active NCE draft per student exercise.
-- Why: Concurrent draft saves can otherwise create duplicate active drafts before submission.

WITH ranked_drafts AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY course_id, exercise_id, student_id
      ORDER BY updated_at DESC, created_at DESC, id DESC
    ) AS draft_rank
  FROM public.nce_exercise_attempts
  WHERE status = 'draft'
)
DELETE FROM public.nce_exercise_attempts attempt
USING ranked_drafts ranked
WHERE attempt.id = ranked.id
  AND ranked.draft_rank > 1;

CREATE UNIQUE INDEX IF NOT EXISTS nce_attempts_one_draft_per_student_exercise_key
  ON public.nce_exercise_attempts(course_id, exercise_id, student_id)
  WHERE status = 'draft';
