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
  page_id UUID PRIMARY KEY REFERENCES public.cms_page_contents(id) ON DELETE CASCADE,
  content_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.cms_page_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID NOT NULL REFERENCES public.cms_page_contents(id) ON DELETE CASCADE,
  revision_number INTEGER NOT NULL,
  content_json JSONB NOT NULL,
  operation TEXT NOT NULL,
  created_by_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  source_revision_id UUID REFERENCES public.cms_page_revisions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT cms_page_revisions_page_revision_key UNIQUE (page_id, revision_number),
  CONSTRAINT cms_page_revisions_operation_check CHECK (operation IN ('publish', 'rollback'))
);

CREATE INDEX cms_page_revisions_page_created_idx
  ON public.cms_page_revisions(page_id, created_at DESC);
CREATE INDEX cms_page_revisions_created_by_idx
  ON public.cms_page_revisions(created_by_id);

-- Secure newly granted operations even if deployment stops before policy creation.
ALTER TABLE public.cms_page_contents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_page_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_page_revisions ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.cms_page_revisions TO authenticated;
GRANT UPDATE (draft_version, published_draft_version, published_revision, published_at, updated_at)
  ON public.cms_page_contents TO authenticated;
