-- File: migrations/20260921120000_reconcile_official_grade_status/migration.sql
-- Purpose: Repair historical submissions whose official grade was seeded separately.
-- Why: Assignment status must agree with the active authoritative grade record.
UPDATE public.submissions AS submission
SET status = 'graded'::"SubmissionStatus"
WHERE submission."deletedAt" IS NULL
  AND submission.status <> 'graded'::"SubmissionStatus"
  AND EXISTS (
    SELECT 1 FROM public.grades AS grade
    WHERE grade.submission_id = submission.id AND grade."deletedAt" IS NULL
  );
