-- File: backend/tests/prisma/runtimeRoleBoundary.probe.sql
-- Purpose: Exercise every PR-48A database access-matrix role against PostgreSQL.
-- Why: Static migration checks cannot detect missing grants or RLS policies.

BEGIN;
SET LOCAL ROLE anon;
SELECT count(*) FROM public.ielts_config_versions;
SELECT count(*) FROM public.ielts_question_options;
SELECT count(*) FROM public.ielts_assignment_types;
SELECT count(*) FROM public.ielts_question_types;
SELECT count(*) FROM public.ielts_writing_task_types;
SELECT count(*) FROM public.ielts_speaking_part_types;
SELECT count(*) FROM public.ielts_completion_formats;
SELECT count(*) FROM public.ielts_sample_timing_options;
DO $probe$
BEGIN
  IF has_table_privilege(current_user, 'public.users', 'SELECT') OR
     has_table_privilege(current_user, 'public.users', 'UPDATE') THEN
    RAISE EXCEPTION 'anon received private users privileges';
  END IF;
  BEGIN
    PERFORM 1 FROM public.users LIMIT 1;
    RAISE EXCEPTION 'anon read private users';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE public.ielts_config_versions SET name = name WHERE false;
    RAISE EXCEPTION 'anon wrote IELTS reference data';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END
$probe$;
ROLLBACK;

BEGIN;
SET LOCAL ROLE authenticated;
SELECT count(*) FROM public.ielts_config_versions;
SELECT count(*) FROM public.ielts_question_options;
SELECT count(*) FROM public.ielts_assignment_types;
SELECT count(*) FROM public.ielts_question_types;
SELECT count(*) FROM public.ielts_writing_task_types;
SELECT count(*) FROM public.ielts_speaking_part_types;
SELECT count(*) FROM public.ielts_completion_formats;
SELECT count(*) FROM public.ielts_sample_timing_options;
DO $probe$
BEGIN
  IF has_table_privilege(current_user, 'public.users', 'SELECT') OR
     has_table_privilege(current_user, 'public.users', 'UPDATE') THEN
    RAISE EXCEPTION 'authenticated received private users privileges';
  END IF;
  BEGIN
    PERFORM 1 FROM public.users LIMIT 1;
    RAISE EXCEPTION 'authenticated read private users';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE public.ielts_config_versions SET name = name WHERE false;
    RAISE EXCEPTION 'authenticated wrote IELTS reference data';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END
$probe$;
ROLLBACK;

BEGIN;
SET LOCAL ROLE nce_app_anon;
DO $probe$
BEGIN
  IF has_table_privilege(current_user, 'public.users', 'SELECT') OR
     has_table_privilege(current_user, 'public.grades', 'UPDATE') OR
     has_table_privilege(current_user, 'public.auth_sessions', 'SELECT') OR
     has_table_privilege(current_user, 'public.identities', 'SELECT') THEN
    RAISE EXCEPTION 'nce_app_anon received a private-table privilege';
  END IF;
  BEGIN
    PERFORM 1 FROM public.users LIMIT 1;
    RAISE EXCEPTION 'nce_app_anon read users';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    TRUNCATE public.users;
    RAISE EXCEPTION 'nce_app_anon truncated users';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END
$probe$;
ROLLBACK;

BEGIN;
SET LOCAL ROLE nce_app_authenticated;
SELECT count(*) FROM public.users;
UPDATE public.users SET email = email WHERE false;
DO $probe$
BEGIN
  IF has_table_privilege(current_user, 'public.auth_sessions', 'SELECT') OR
     has_table_privilege(current_user, 'public.identities', 'SELECT') THEN
    RAISE EXCEPTION 'nce_app_authenticated received auth-table privileges';
  END IF;
  BEGIN
    PERFORM 1 FROM public.auth_sessions LIMIT 1;
    RAISE EXCEPTION 'nce_app_authenticated read auth sessions';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    TRUNCATE public.users;
    RAISE EXCEPTION 'nce_app_authenticated truncated users';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END
$probe$;
ROLLBACK;

BEGIN;
SET LOCAL ROLE service_role;
SELECT count(*) FROM public.users;
UPDATE public.users SET email = email WHERE false;
DO $probe$
BEGIN
  BEGIN
    DELETE FROM public.users WHERE false;
    RAISE EXCEPTION 'service_role deleted users';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END
$probe$;
ROLLBACK;
