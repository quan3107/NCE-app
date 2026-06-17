-- File: backend/src/prisma/migrations/20260617134000_align_navigation_schema_columns/migration.sql
-- Purpose: Align navigation and permission tables with the current Prisma schema.
-- Why: Clean resets create the original snake_case timestamp columns, but runtime seeds use camelCase timestamps.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'permissions' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE public.permissions RENAME COLUMN created_at TO "createdAt";
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'role_permissions' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE public.role_permissions RENAME COLUMN created_at TO "createdAt";
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'navigation_items' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE public.navigation_items RENAME COLUMN created_at TO "createdAt";
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'navigation_items' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.navigation_items RENAME COLUMN updated_at TO "updatedAt";
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'feature_flags' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE public.feature_flags RENAME COLUMN created_at TO "createdAt";
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'feature_flags' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.feature_flags RENAME COLUMN updated_at TO "updatedAt";
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'feature_flag_roles' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE public.feature_flag_roles RENAME COLUMN created_at TO "createdAt";
  END IF;
END $$;

ALTER TABLE public.permissions
  ALTER COLUMN "createdAt" SET DEFAULT NOW(),
  ALTER COLUMN "createdAt" SET NOT NULL;

ALTER TABLE public.role_permissions
  ALTER COLUMN "createdAt" SET DEFAULT NOW(),
  ALTER COLUMN "createdAt" SET NOT NULL;

ALTER TABLE public.navigation_items
  ALTER COLUMN order_index SET DEFAULT 0,
  ALTER COLUMN order_index SET NOT NULL,
  ALTER COLUMN is_active SET DEFAULT TRUE,
  ALTER COLUMN is_active SET NOT NULL,
  ALTER COLUMN "createdAt" SET DEFAULT NOW(),
  ALTER COLUMN "createdAt" SET NOT NULL,
  ALTER COLUMN "updatedAt" SET DEFAULT NOW(),
  ALTER COLUMN "updatedAt" SET NOT NULL;

ALTER TABLE public.feature_flags
  ALTER COLUMN enabled SET DEFAULT FALSE,
  ALTER COLUMN enabled SET NOT NULL,
  ALTER COLUMN "createdAt" SET DEFAULT NOW(),
  ALTER COLUMN "createdAt" SET NOT NULL,
  ALTER COLUMN "updatedAt" SET DEFAULT NOW(),
  ALTER COLUMN "updatedAt" SET NOT NULL;

ALTER TABLE public.feature_flag_roles
  ALTER COLUMN "createdAt" SET DEFAULT NOW(),
  ALTER COLUMN "createdAt" SET NOT NULL;
