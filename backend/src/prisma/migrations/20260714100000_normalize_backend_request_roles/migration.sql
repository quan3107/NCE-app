-- File: backend/src/prisma/migrations/20260714100000_normalize_backend_request_roles/migration.sql
-- Purpose: Normalize and validate pre-existing backend request-role groups.
-- Why: SET-only runtime access must not target login-capable or elevated roles.

BEGIN;

DO $request_roles$
DECLARE
  role_name text;
  parent_role text;
  role_state record;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['nce_app_anon', 'nce_app_authenticated']
  LOOP
    SELECT * INTO role_state FROM pg_roles WHERE rolname = role_name;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'required backend request role % is missing', role_name;
    END IF;
    IF role_state.rolsuper THEN
      RAISE EXCEPTION 'backend request role % is a superuser; remediate manually', role_name;
    END IF;
  END LOOP;

  ALTER ROLE nce_app_anon NOLOGIN NOCREATEDB NOCREATEROLE
    NOREPLICATION NOBYPASSRLS INHERIT;
  ALTER ROLE nce_app_authenticated NOLOGIN NOCREATEDB NOCREATEROLE
    NOREPLICATION NOBYPASSRLS INHERIT;

  -- Request roles inherit browser policies but cannot switch into browser roles.
  GRANT anon TO nce_app_anon
    WITH ADMIN FALSE, INHERIT TRUE, SET FALSE;
  GRANT authenticated TO nce_app_authenticated
    WITH ADMIN FALSE, INHERIT TRUE, SET FALSE;

  FOR role_name, parent_role IN
    SELECT * FROM (VALUES
      ('nce_app_anon', 'anon'),
      ('nce_app_authenticated', 'authenticated')
    ) AS expected(role_name, parent_role)
  LOOP
    SELECT * INTO role_state FROM pg_roles WHERE rolname = role_name;
    IF role_state.rolcanlogin OR role_state.rolsuper OR
       role_state.rolcreatedb OR role_state.rolcreaterole OR
       role_state.rolreplication OR role_state.rolbypassrls OR
       NOT role_state.rolinherit THEN
      RAISE EXCEPTION 'backend request role % retains unsafe attributes', role_name;
    END IF;

    IF pg_has_role('authenticator', role_name, 'MEMBER') THEN
      RAISE EXCEPTION 'authenticator can assume backend request role %', role_name;
    END IF;

    IF (
      SELECT count(*)
      FROM pg_auth_members membership
      JOIN pg_roles member ON member.oid = membership.member
      WHERE member.rolname = role_name
    ) <> 1 OR NOT EXISTS (
      SELECT 1
      FROM pg_auth_members membership
      JOIN pg_roles granted ON granted.oid = membership.roleid
      JOIN pg_roles member ON member.oid = membership.member
      JOIN pg_roles grantor ON grantor.oid = membership.grantor
      WHERE granted.rolname = parent_role
        AND member.rolname = role_name
        AND grantor.rolname = CURRENT_USER
        AND NOT membership.admin_option
        AND membership.inherit_option
        AND NOT membership.set_option
    ) THEN
      RAISE EXCEPTION 'backend request role % has unexpected inherited memberships', role_name;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_auth_members membership
      JOIN pg_roles granted ON granted.oid = membership.roleid
      JOIN pg_roles member ON member.oid = membership.member
      JOIN pg_roles grantor ON grantor.oid = membership.grantor
      WHERE granted.rolname = role_name
        AND member.rolname = 'nce_runtime'
        AND grantor.rolname = CURRENT_USER
        AND NOT membership.admin_option
        AND NOT membership.inherit_option
        AND membership.set_option
    ) THEN
      RAISE EXCEPTION 'runtime SET-only membership for % is missing', role_name;
    END IF;
  END LOOP;

  -- PostgreSQL 16+ can record an owner-admin membership at role creation.
  -- Preserve only that row plus the reviewed runtime SET-only membership.
  IF EXISTS (
    SELECT 1
    FROM pg_auth_members membership
    JOIN pg_roles granted ON granted.oid = membership.roleid
    JOIN pg_roles member ON member.oid = membership.member
    JOIN pg_roles grantor ON grantor.oid = membership.grantor
    WHERE granted.rolname IN ('nce_app_anon', 'nce_app_authenticated')
      AND NOT (
        member.rolname = 'nce_runtime'
        AND grantor.rolname = CURRENT_USER
        AND NOT membership.admin_option
        AND NOT membership.inherit_option
        AND membership.set_option
      )
      AND NOT (
        member.rolname = CURRENT_USER
        AND membership.admin_option
        AND NOT membership.inherit_option
        AND NOT membership.set_option
      )
  ) THEN
    RAISE EXCEPTION 'backend request role has an unexpected member';
  END IF;
END
$request_roles$;

COMMIT;
