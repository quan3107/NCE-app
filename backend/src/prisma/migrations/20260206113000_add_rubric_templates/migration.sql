-- File: backend/src/prisma/migrations/20260206113000_add_rubric_templates/migration.sql
-- Purpose: Add backend-managed rubric templates for course defaults and grading defaults.
-- Why: Replace frontend hardcoded rubric criteria with configurable backend data.

CREATE TABLE public.rubric_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  context TEXT NOT NULL CHECK (context IN ('course', 'assignment', 'grading')),
  assignment_type TEXT NOT NULL CHECK (assignment_type IN ('reading', 'listening', 'writing', 'speaking', 'generic')),
  criteria JSONB NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX rubric_tpl_ctx_type_name_key
  ON public.rubric_templates(context, assignment_type, name);

CREATE INDEX rubric_tpl_ctx_type_active_sort_idx
  ON public.rubric_templates(context, assignment_type, is_active, sort_order);

-- Core app requests run under the authenticated role.
GRANT SELECT, INSERT, UPDATE ON public.rubric_templates TO authenticated;
