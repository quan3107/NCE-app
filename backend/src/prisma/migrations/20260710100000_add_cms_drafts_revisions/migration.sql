-- File: backend/src/prisma/migrations/20260710100000_add_cms_drafts_revisions/migration.sql
-- Purpose: Add CMS draft state and immutable publish/rollback revisions.
-- Why: Public content must remain stable until an administrator explicitly publishes it.

ALTER TABLE public.cms_page_contents
  ADD COLUMN draft_version INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN published_draft_version INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN published_revision INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN published_at TIMESTAMPTZ;

UPDATE public.cms_page_contents
SET published_at = updated_at
WHERE published_at IS NULL;

CREATE TABLE public.cms_page_drafts (
  page_id UUID PRIMARY KEY,
  content_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE public.cms_page_revisions (
  id UUID PRIMARY KEY,
  page_id UUID NOT NULL,
  revision_number INTEGER NOT NULL,
  content_json JSONB NOT NULL,
  operation TEXT NOT NULL,
  created_by_id UUID,
  source_revision_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT cms_page_revisions_operation_check CHECK (operation IN ('publish', 'rollback'))
);

CREATE UNIQUE INDEX cms_page_revisions_page_id_revision_number_key
  ON public.cms_page_revisions(page_id, revision_number);
CREATE INDEX cms_page_revisions_page_id_created_at_idx
  ON public.cms_page_revisions(page_id, created_at);
CREATE INDEX cms_page_revisions_created_by_id_idx
  ON public.cms_page_revisions(created_by_id);

ALTER TABLE public.cms_page_drafts
  ADD CONSTRAINT cms_page_drafts_page_id_fkey
  FOREIGN KEY (page_id) REFERENCES public.cms_page_contents(id)
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE public.cms_page_revisions
  ADD CONSTRAINT cms_page_revisions_page_id_fkey
  FOREIGN KEY (page_id) REFERENCES public.cms_page_contents(id)
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE public.cms_page_revisions
  ADD CONSTRAINT cms_page_revisions_created_by_id_fkey
  FOREIGN KEY (created_by_id) REFERENCES public.users(id)
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE public.cms_page_revisions
  ADD CONSTRAINT cms_page_revisions_source_revision_id_fkey
  FOREIGN KEY (source_revision_id) REFERENCES public.cms_page_revisions(id)
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Secure newly granted operations even if deployment stops before policy creation.
ALTER TABLE public.cms_page_contents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_page_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_page_revisions ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.cms_page_revisions TO authenticated;
GRANT UPDATE (draft_version, published_draft_version, published_revision, published_at, updated_at)
  ON public.cms_page_contents TO authenticated;
