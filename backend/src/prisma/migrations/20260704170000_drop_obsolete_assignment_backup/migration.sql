-- File: backend/src/prisma/migrations/20260704170000_drop_obsolete_assignment_backup/migration.sql
-- Purpose: Remove the obsolete assignments backup table after verifying it is empty.
-- Why: Keeps Prisma schema drift focused on active application tables.

DO $$
DECLARE
  backup_rows bigint;
BEGIN
  IF to_regclass('public.assignments_backup_20260204') IS NULL THEN
    RETURN;
  END IF;

  SELECT count(*) INTO backup_rows
  FROM public.assignments_backup_20260204;

  IF backup_rows > 0 THEN
    RAISE EXCEPTION
      'public.assignments_backup_20260204 contains % rows; export or archive it before dropping the table.',
      backup_rows;
  END IF;

  DROP TABLE IF EXISTS public.assignments_backup_20260204;
END $$;
