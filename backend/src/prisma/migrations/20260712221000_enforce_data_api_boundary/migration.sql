-- File: backend/src/prisma/migrations/20260712221000_enforce_data_api_boundary/migration.sql
-- Purpose: Revoke private Data API access after isolated backend roles exist.
-- Why: Browser tokens must retain only deliberately reviewed public surfaces.

BEGIN;

-- Add compatibility policies only where an isolated role has an explicit grant
-- and the predecessor table had no RLS. Existing policy-governed tables keep
-- their policies through one-way anon/authenticated membership.
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
    IF NOT relation.relrowsecurity THEN
      IF has_table_privilege(
        'nce_app_anon', relation.oid, 'SELECT,INSERT,UPDATE,DELETE'
      ) OR has_any_column_privilege(
        'nce_app_anon', relation.oid, 'SELECT,INSERT,UPDATE,REFERENCES'
      ) THEN
        EXECUTE format(
          'CREATE POLICY nce_app_legacy_anon ON %s FOR ALL TO nce_app_anon USING (true) WITH CHECK (true)',
          relation.oid::regclass
        );
      END IF;
      IF has_table_privilege(
        'nce_app_authenticated', relation.oid, 'SELECT,INSERT,UPDATE,DELETE'
      ) OR has_any_column_privilege(
        'nce_app_authenticated', relation.oid, 'SELECT,INSERT,UPDATE,REFERENCES'
      ) THEN
        EXECUTE format(
          'CREATE POLICY nce_app_legacy_authenticated ON %s FOR ALL TO nce_app_authenticated USING (true) WITH CHECK (true)',
          relation.oid::regclass
        );
      END IF;
    END IF;
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', relation.oid::regclass);
  END LOOP;
END
$tables$;

-- IELTS configuration is intentional public reference data. Grants and RLS
-- policies land together before the broader browser-role revocation.
DO $ielts_reference$
DECLARE
  relation_name text;
BEGIN
  FOREACH relation_name IN ARRAY ARRAY[
    'ielts_config_versions', 'ielts_question_options',
    'ielts_assignment_types', 'ielts_question_types',
    'ielts_writing_task_types', 'ielts_speaking_part_types',
    'ielts_completion_formats', 'ielts_sample_timing_options'
  ]
  LOOP
    EXECUTE format(
      'GRANT SELECT ON TABLE public.%I TO anon, authenticated', relation_name
    );
    EXECUTE format(
      'CREATE POLICY ielts_reference_browser_select ON public.%I FOR SELECT TO anon, authenticated USING (true)',
      relation_name
    );
  END LOOP;
END
$ielts_reference$;

-- Only deliberately public product surfaces retain browser grants.
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

-- Application helpers are not a public RPC surface.
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

DROP EXTENSION IF EXISTS pg_graphql;

-- Future objects stay private until a migration grants a reviewed surface.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE USAGE, SELECT, UPDATE ON SEQUENCES FROM anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated, service_role;

COMMIT;
