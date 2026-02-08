-- File: backend/src/prisma/migrations/20260208043000_add_cms_sections_is_active/migration.sql
-- Purpose: Add missing active flag column to cms_sections.
-- Why: Prisma model expects cms_sections.is_active and CMS seed writes this field.
-- Note: Idempotent and backfills existing rows safely.

ALTER TABLE public.cms_sections
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN;

UPDATE public.cms_sections
SET is_active = TRUE
WHERE is_active IS NULL;

ALTER TABLE public.cms_sections
  ALTER COLUMN is_active SET DEFAULT TRUE;

ALTER TABLE public.cms_sections
  ALTER COLUMN is_active SET NOT NULL;
