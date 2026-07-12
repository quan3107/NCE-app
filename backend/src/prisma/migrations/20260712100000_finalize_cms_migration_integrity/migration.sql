-- File: backend/src/prisma/migrations/20260712100000_finalize_cms_migration_integrity/migration.sql
-- Purpose: Consolidate CMS corrections after restoring immutable applied migration history.
-- Why: Hosted and clean databases must converge without editing recorded migration bytes.

BEGIN;

CREATE TABLE IF NOT EXISTS public.cms_page_drafts (
  page_id UUID PRIMARY KEY,
  content_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL
);

-- Preserve legacy draft JSON before removing the publicly readable column.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'cms_page_contents'
      AND column_name = 'draft_content'
  ) THEN
    EXECUTE $backfill$
      INSERT INTO public.cms_page_drafts (
        page_id,
        content_json,
        created_at,
        updated_at
      )
      SELECT id, draft_content, created_at, updated_at
      FROM public.cms_page_contents
      WHERE draft_content IS NOT NULL
      ON CONFLICT (page_id) DO NOTHING
    $backfill$;

    EXECUTE 'ALTER TABLE public.cms_page_contents DROP COLUMN draft_content';
  END IF;
END
$$;

-- Match defaults and names generated from schema.prisma.
ALTER TABLE public.cms_page_drafts
  ALTER COLUMN updated_at DROP DEFAULT;
ALTER TABLE public.cms_page_revisions
  ALTER COLUMN id DROP DEFAULT;

ALTER TABLE public.cms_page_revisions
  DROP CONSTRAINT IF EXISTS cms_page_revisions_page_revision_key;
DROP INDEX IF EXISTS public.cms_page_revisions_page_created_idx;
DROP INDEX IF EXISTS public.cms_page_revisions_created_by_idx;

CREATE UNIQUE INDEX IF NOT EXISTS cms_page_revisions_page_id_revision_number_key
  ON public.cms_page_revisions(page_id, revision_number);
CREATE INDEX IF NOT EXISTS cms_page_revisions_page_id_created_at_idx
  ON public.cms_page_revisions(page_id, created_at);
CREATE INDEX IF NOT EXISTS cms_page_revisions_created_by_id_idx
  ON public.cms_page_revisions(created_by_id);
CREATE INDEX IF NOT EXISTS cms_page_revisions_source_revision_id_idx
  ON public.cms_page_revisions(source_revision_id);

-- Recreate foreign keys with Prisma's default cascading update behavior.
ALTER TABLE public.cms_page_drafts
  DROP CONSTRAINT IF EXISTS cms_page_drafts_page_id_fkey;
ALTER TABLE public.cms_page_drafts
  ADD CONSTRAINT cms_page_drafts_page_id_fkey
  FOREIGN KEY (page_id) REFERENCES public.cms_page_contents(id)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE public.cms_page_revisions
  DROP CONSTRAINT IF EXISTS cms_page_revisions_page_id_fkey;
ALTER TABLE public.cms_page_revisions
  ADD CONSTRAINT cms_page_revisions_page_id_fkey
  FOREIGN KEY (page_id) REFERENCES public.cms_page_contents(id)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE public.cms_page_revisions
  DROP CONSTRAINT IF EXISTS cms_page_revisions_created_by_id_fkey;
ALTER TABLE public.cms_page_revisions
  ADD CONSTRAINT cms_page_revisions_created_by_id_fkey
  FOREIGN KEY (created_by_id) REFERENCES public.users(id)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE public.cms_page_revisions
  DROP CONSTRAINT IF EXISTS cms_page_revisions_source_revision_id_fkey;
ALTER TABLE public.cms_page_revisions
  ADD CONSTRAINT cms_page_revisions_source_revision_id_fkey
  FOREIGN KEY (source_revision_id) REFERENCES public.cms_page_revisions(id)
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Enable RLS for every CMS write target before reasserting role grants.
ALTER TABLE public.cms_page_contents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_content_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_page_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_page_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cms_page_drafts_admin_read ON public.cms_page_drafts;
DROP POLICY IF EXISTS cms_page_drafts_admin_insert ON public.cms_page_drafts;
DROP POLICY IF EXISTS cms_page_drafts_admin_update ON public.cms_page_drafts;

CREATE POLICY cms_page_drafts_admin_read
  ON public.cms_page_drafts FOR SELECT
  TO authenticated
  USING (current_setting('app.current_user_role', true) = 'admin');
CREATE POLICY cms_page_drafts_admin_insert
  ON public.cms_page_drafts FOR INSERT
  TO authenticated
  WITH CHECK (current_setting('app.current_user_role', true) = 'admin');
CREATE POLICY cms_page_drafts_admin_update
  ON public.cms_page_drafts FOR UPDATE
  TO authenticated
  USING (current_setting('app.current_user_role', true) = 'admin')
  WITH CHECK (current_setting('app.current_user_role', true) = 'admin');

GRANT INSERT, UPDATE, DELETE ON public.cms_sections TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.cms_content_items TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.cms_page_revisions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.cms_page_drafts TO authenticated;
GRANT UPDATE (draft_version, published_draft_version, published_revision, published_at, updated_at)
  ON public.cms_page_contents TO authenticated;

COMMIT;
