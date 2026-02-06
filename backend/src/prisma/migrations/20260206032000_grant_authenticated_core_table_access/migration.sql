-- File: backend/src/prisma/migrations/20260206032000_grant_authenticated_core_table_access/migration.sql
-- Purpose: Restore baseline table grants for authenticated and anon runtime roles.
-- Why: Request-scoped DB role switching relies on grants before app-level filters and guards run.
-- Note: GRANT statements are idempotent and safe to re-run.

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- Public course listing + authenticated read path.
GRANT SELECT ON public.courses TO anon;
GRANT SELECT ON public.courses_public TO anon, authenticated;

-- Core application tables queried under the authenticated role.
GRANT SELECT, INSERT, UPDATE ON
  public.users,
  public.courses,
  public.enrollments,
  public.assignments,
  public.rubrics,
  public.submissions,
  public.grades,
  public.notifications,
  public.files,
  public.audit_logs
TO authenticated;

-- Public IELTS config endpoints run without auth (anon role).
GRANT SELECT ON
  public.ielts_config_versions,
  public.ielts_assignment_types,
  public.ielts_question_types,
  public.ielts_writing_task_types,
  public.ielts_speaking_part_types,
  public.ielts_completion_formats,
  public.ielts_sample_timing_options
TO anon, authenticated;
