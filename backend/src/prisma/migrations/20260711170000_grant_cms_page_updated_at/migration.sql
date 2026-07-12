-- File: backend/src/prisma/migrations/20260711170000_grant_cms_page_updated_at/migration.sql
-- Purpose: Grant authenticated CMS writes access to every Prisma-managed page column.
-- Why: Databases that already ran the reconciliation still lack UPDATE on updated_at.

BEGIN;

GRANT UPDATE (draft_version, published_draft_version, published_revision, published_at, updated_at)
  ON public.cms_page_contents TO authenticated;

COMMIT;
