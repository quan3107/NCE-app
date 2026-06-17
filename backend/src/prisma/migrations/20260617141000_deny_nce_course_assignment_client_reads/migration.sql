-- File: backend/src/prisma/migrations/20260617141000_deny_nce_course_assignment_client_reads/migration.sql
-- Purpose: Record an explicit authenticated deny policy for NCE course lesson assignments.
-- Why: Course mappings are backend-managed and must not be visible through authenticated Supabase clients.

CREATE POLICY nce_course_lesson_assignments_deny_authenticated_select
ON public.nce_course_lesson_assignments
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (false);
