-- File: backend/src/prisma/migrations/20260712220000_harden_data_api_runtime_roles/migration.sql
-- Purpose: Isolate backend database roles from Supabase Data API roles.
-- Why: Browser tokens must not inherit the backend's broad application-table access.

DO $roles$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nce_app_anon') THEN
    CREATE ROLE nce_app_anon NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nce_app_authenticated') THEN
    CREATE ROLE nce_app_authenticated NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
  END IF;
END
$roles$;

-- Membership is one-way: backend roles reuse existing RLS policies, while the
-- PostgREST authenticator is never allowed to assume either backend role.
GRANT anon TO nce_app_anon;
GRANT authenticated TO nce_app_authenticated;
GRANT nce_app_anon, nce_app_authenticated TO CURRENT_USER WITH SET TRUE;

GRANT USAGE ON SCHEMA public, app TO nce_app_anon, nce_app_authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public
  TO nce_app_anon, nce_app_authenticated;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public
  TO nce_app_anon, nce_app_authenticated;

-- Preserve the pre-hardening backend behavior for tables that did not yet use
-- RLS. Tables with established policies continue to use those policies through
-- the one-way anon/authenticated membership above.
DO $tables$
DECLARE
  relation record;
BEGIN
  FOR relation IN
    SELECT c.oid, c.relname, c.relrowsecurity
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
  LOOP
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', relation.oid::regclass);
    IF NOT relation.relrowsecurity THEN
      EXECUTE format(
        'CREATE POLICY %I ON %s FOR ALL TO nce_app_anon USING (true) WITH CHECK (true)',
        'nce_app_legacy_anon_all', relation.oid::regclass
      );
      EXECUTE format(
        'CREATE POLICY %I ON %s FOR ALL TO nce_app_authenticated USING (true) WITH CHECK (true)',
        'nce_app_legacy_authenticated_all', relation.oid::regclass
      );
    END IF;
  END LOOP;
END
$tables$;

-- Only these deliberately public product surfaces retain their historical,
-- policy-filtered and/or column-scoped browser grants. Everything else becomes
-- backend-only even though it remains in the exposed public schema.
DO $data_api$
DECLARE
  relation record;
  approved text[] := ARRAY[
    'courses_public',
    'cms_page_contents', 'cms_sections', 'cms_content_items',
    'ielts_config_versions', 'ielts_question_options',
    'ielts_assignment_types', 'ielts_question_types',
    'ielts_writing_task_types', 'ielts_speaking_part_types',
    'ielts_completion_formats', 'ielts_sample_timing_options',
    'nce_books', 'nce_units', 'nce_lessons', 'nce_objectives',
    'nce_exercises', 'nce_course_lesson_assignments'
  ];
BEGIN
  FOR relation IN
    SELECT c.oid, c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm')
      AND NOT (c.relname = ANY (approved))
  LOOP
    EXECUTE format(
      'REVOKE ALL PRIVILEGES ON TABLE %s FROM anon, authenticated',
      relation.oid::regclass
    );
  END LOOP;
END
$data_api$;

REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;

-- Application helpers are not a public RPC surface. Explicit grants keep RLS
-- and the intentionally narrow courses_public exception working.
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA app FROM PUBLIC;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app
  TO anon, authenticated, nce_app_anon, nce_app_authenticated, service_role;
DO $helper_search_paths$
BEGIN
  IF to_regprocedure('app.current_user_id()') IS NOT NULL THEN
    ALTER FUNCTION app.current_user_id() SET search_path = pg_catalog;
  END IF;
  IF to_regprocedure('app.current_user_role()') IS NOT NULL THEN
    ALTER FUNCTION app.current_user_role() SET search_path = pg_catalog;
  END IF;
  IF to_regprocedure('app.is_admin()') IS NOT NULL THEN
    ALTER FUNCTION app.is_admin() SET search_path = pg_catalog;
  END IF;
END
$helper_search_paths$;

-- The application has no GraphQL client. Removing pg_graphql eliminates a
-- second discovery/query surface over the same public-schema relations.
DROP EXTENSION IF EXISTS pg_graphql;

-- Future Prisma-created objects are private to browser roles unless a later
-- migration deliberately grants a reviewed Data API surface together with RLS.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE USAGE, SELECT, UPDATE ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO nce_app_anon, nce_app_authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO nce_app_anon, nce_app_authenticated;
