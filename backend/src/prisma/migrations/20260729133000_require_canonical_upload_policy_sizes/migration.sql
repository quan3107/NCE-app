-- File: backend/src/prisma/migrations/20260729133000_require_canonical_upload_policy_sizes/migration.sql
-- Purpose: Restrict upload-policy writes to exact whole-MiB byte values.
-- Why: The settings API represents limits as integer MiB and must round-trip exactly.

BEGIN;

SET lock_timeout = '5s';
SET statement_timeout = '5min';

CREATE OR REPLACE FUNCTION app.update_file_upload_policy(
  p_role TEXT,
  p_expected_max_file_size INTEGER,
  p_max_file_size INTEGER
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF current_setting('app.current_user_role', true) IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Only administrators may update file upload policies.'
      USING ERRCODE = '42501';
  END IF;

  IF p_role NOT IN ('student', 'teacher', 'admin')
    OR p_expected_max_file_size NOT BETWEEN 1048576 AND 104857600
    OR p_max_file_size NOT BETWEEN 1048576 AND 104857600
  THEN
    RAISE EXCEPTION 'Invalid file upload policy update.'
      USING ERRCODE = '22023';
  END IF;

  IF p_expected_max_file_size % 1048576 <> 0
    OR p_max_file_size % 1048576 <> 0
  THEN
    RAISE EXCEPTION 'File upload policy sizes must be exact whole MiB values.'
      USING ERRCODE = '23514';
  END IF;

  UPDATE public.file_upload_policies
  SET
    max_file_size = p_max_file_size,
    updated_at = NOW()
  WHERE role = p_role::public."UserRole"
    AND max_file_size = p_expected_max_file_size;

  RETURN FOUND;
END;
$function$;

REVOKE ALL ON FUNCTION app.update_file_upload_policy(TEXT, INTEGER, INTEGER)
FROM PUBLIC;

GRANT EXECUTE ON FUNCTION app.update_file_upload_policy(TEXT, INTEGER, INTEGER)
TO nce_app_authenticated;

COMMIT;
