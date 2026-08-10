-- File: backend/src/prisma/migrations/20260731160000_lock_upload_policy_admin_actor/migration.sql
-- Purpose: Authorize upload-policy writes against the locked database user row.
-- Why: Token role claims can outlive administrator suspension, deletion, or demotion.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE OR REPLACE FUNCTION app.update_file_upload_policy(
  p_role TEXT,
  p_expected_max_file_size INTEGER,
  p_max_file_size INTEGER
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_admin_id UUID;
BEGIN
  -- Hold the actor row through the caller's transaction so authorization
  -- cannot change between the policy update and its audit event.
  SELECT users.id
  INTO v_admin_id
  FROM public.users AS users
  WHERE users.id = current_setting('app.current_user_id', true)::UUID
    AND users.role = 'admin'
    AND users.status = 'active'
    AND users."deletedAt" IS NULL
  FOR SHARE;

  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Only active administrators may update file upload policies.'
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
