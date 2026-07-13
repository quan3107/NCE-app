-- File: backend/src/prisma/migrations/20260712220000_harden_data_api_runtime_roles/migration.sql
-- Purpose: Add isolated backend roles with predecessor-equivalent privileges.
-- Why: The backend must stop using Data API roles without broadening anonymous access.

DO $roles$
BEGIN
  -- The migration owner and runtime login are intentionally separate. Hosted
  -- postgres keeps its Supabase-managed membership; it provisions a new grant
  -- that it controls for the least-privilege application login.
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    RAISE EXCEPTION 'provision service_role before applying this migration';
  END IF;
  IF CURRENT_USER = 'nce_runtime' THEN
    RAISE EXCEPTION 'DIRECT_URL must use the migration owner, not nce_runtime';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_auth_members membership
    JOIN pg_roles granted ON granted.oid = membership.roleid
    JOIN pg_roles member ON member.oid = membership.member
    JOIN pg_roles grantor ON grantor.oid = membership.grantor
    WHERE granted.rolname = 'service_role'
      AND member.rolname = 'nce_runtime'
      AND grantor.rolname = CURRENT_USER
      AND NOT membership.admin_option
      AND NOT membership.inherit_option
      AND membership.set_option
  ) THEN
    RAISE EXCEPTION 'provision a SET-only service_role grant from the migration owner to nce_runtime';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM pg_auth_members membership
    JOIN pg_roles granted ON granted.oid = membership.roleid
    JOIN pg_roles member ON member.oid = membership.member
    JOIN pg_roles grantor ON grantor.oid = membership.grantor
    WHERE granted.rolname = 'service_role'
      AND member.rolname = 'nce_runtime'
      AND (
        grantor.rolname <> CURRENT_USER OR
        membership.admin_option OR
        membership.inherit_option OR
        NOT membership.set_option
      )
  ) THEN
    RAISE EXCEPTION 'nce_runtime has an unexpected service_role membership row';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_roles
    WHERE rolname = 'nce_runtime'
      AND rolcanlogin
      AND NOT rolsuper
      AND NOT rolinherit
      AND NOT rolcreaterole
      AND NOT rolcreatedb
      AND NOT rolreplication
      AND NOT rolbypassrls
  ) THEN
    RAISE EXCEPTION 'nce_runtime must be a NOINHERIT least-privilege login';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nce_app_anon') THEN
    CREATE ROLE nce_app_anon NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nce_app_authenticated') THEN
    CREATE ROLE nce_app_authenticated NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
  END IF;
END
$roles$;

-- Policy membership is one-way. PostgREST cannot assume either backend role.
GRANT anon TO nce_app_anon;
GRANT authenticated TO nce_app_authenticated;
GRANT nce_app_anon, nce_app_authenticated TO nce_runtime
  WITH ADMIN FALSE, SET TRUE, INHERIT FALSE;

GRANT USAGE ON SCHEMA public, app TO nce_app_anon, nce_app_authenticated;

-- Preserve only the anonymous role's predecessor reads. Private account,
-- grade, session, identity, attempt, and authoring tables are intentionally absent.
GRANT SELECT ON
  public.courses,
  public.courses_public,
  public.cms_page_contents,
  public.cms_sections,
  public.cms_content_items,
  public.ielts_config_versions,
  public.ielts_question_options,
  public.ielts_assignment_types,
  public.ielts_question_types,
  public.ielts_writing_task_types,
  public.ielts_speaking_part_types,
  public.ielts_completion_formats,
  public.ielts_sample_timing_options
TO nce_app_anon;

-- Preserve the authenticated predecessor's application-table privileges.
-- Auth sessions, identities, attempts, and service-only authoring remain excluded.
GRANT SELECT, INSERT, UPDATE ON
  public.users,
  public.courses,
  public.enrollments,
  public.assignments,
  public.rubrics,
  public.rubric_templates,
  public.submissions,
  public.grades,
  public.notifications,
  public.files,
  public.audit_logs,
  public.ai_feedback_drafts,
  public.ai_objective_explanations
TO nce_app_authenticated;

GRANT SELECT ON
  public.courses_public,
  public.file_upload_policies,
  public.file_upload_allowed_types,
  public.dashboard_widget_definitions,
  public.notification_type_configs,
  public.course_management_tab_configs,
  public.navigation_items,
  public.permissions,
  public.role_permissions,
  public.feature_flags,
  public.feature_flag_roles,
  public.cms_page_contents,
  public.cms_sections,
  public.cms_content_items,
  public.ielts_config_versions,
  public.ielts_question_options,
  public.ielts_assignment_types,
  public.ielts_question_types,
  public.ielts_writing_task_types,
  public.ielts_speaking_part_types,
  public.ielts_completion_formats,
  public.ielts_sample_timing_options
TO nce_app_authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.user_dashboard_widget_preferences,
  public.user_notification_preferences
TO nce_app_authenticated;

GRANT INSERT, UPDATE, DELETE ON
  public.cms_sections,
  public.cms_content_items
TO nce_app_authenticated;

GRANT SELECT, INSERT, UPDATE ON
  public.cms_page_revisions,
  public.cms_page_drafts
TO nce_app_authenticated;

GRANT UPDATE (
  draft_version,
  published_draft_version,
  published_revision,
  published_at,
  updated_at
) ON public.cms_page_contents TO nce_app_authenticated;

-- NCE catalog grants remain column-scoped so neither request role can read
-- teacher notes or answer keys.
GRANT SELECT (
  id, code, title, level, description, sort_order, status,
  published_at, created_at, updated_at, deleted_at
) ON public.nce_books TO nce_app_anon, nce_app_authenticated;

GRANT SELECT (
  id, book_id, unit_number, title, description, sort_order, status,
  published_at, created_at, updated_at, deleted_at
) ON public.nce_units TO nce_app_anon, nce_app_authenticated;

GRANT SELECT (
  id, unit_id, lesson_number, title, lesson_text, media_json, sort_order,
  status, published_at, created_at, updated_at, deleted_at, course_id
) ON public.nce_lessons TO nce_app_anon, nce_app_authenticated;

GRANT SELECT (
  id, lesson_id, code, title, category, description, mastery_threshold,
  sort_order, created_at, updated_at
) ON public.nce_objectives TO nce_app_anon, nce_app_authenticated;

GRANT SELECT (
  id, lesson_id, objective_id, exercise_type, prompt, content,
  scoring_config, sort_order, created_at, updated_at
) ON public.nce_exercises TO nce_app_anon, nce_app_authenticated;
