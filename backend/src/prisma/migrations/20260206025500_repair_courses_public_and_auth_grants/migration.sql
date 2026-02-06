-- File: backend/src/prisma/migrations/20260206025500_repair_courses_public_and_auth_grants/migration.sql
-- Purpose: Repair missing public courses view and auth service-role grants.
-- Why: Runtime now depends on public.courses_public and auth session writes under service_role.
-- Note: Statements are idempotent and safe to apply repeatedly.

CREATE OR REPLACE VIEW public.courses_public AS
SELECT
  c.id,
  c.title,
  c.description,
  c.schedule_json,
  c.owner_teacher_id,
  app.course_owner_name(c.id) AS owner_name,
  metrics.active_student_count,
  metrics.invited_student_count,
  metrics.teacher_count,
  metrics.assignment_count,
  metrics.rubric_count,
  c.learning_outcomes,
  c.structure_summary,
  c.prerequisites_summary,
  c."createdAt" AS created_at,
  c."updatedAt" AS updated_at
FROM public.courses c
LEFT JOIN LATERAL app.course_metrics(c.id) metrics ON TRUE
WHERE c."deletedAt" IS NULL;

-- Public course listing uses the view for anon/authenticated requests.
GRANT SELECT ON public.courses_public TO anon, authenticated;

-- Refresh/login flows run under service_role and need session/identity access.
GRANT SELECT, INSERT, UPDATE ON public.auth_sessions TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.identities TO service_role;
