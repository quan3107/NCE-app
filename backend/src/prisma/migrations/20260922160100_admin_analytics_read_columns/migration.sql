-- Admin analytics uses the existing trusted NCE read role after an authoritative admin check.
-- Grant only aggregate inputs: no answers, feedback, archived versions, or grade mutations.
GRANT SELECT (id, assignment_id, student_id, status, submitted_at, "deletedAt")
  ON public.submissions TO service_role;
GRANT SELECT (id, submission_id, final_score, band, "deletedAt")
  ON public.grades TO service_role;
