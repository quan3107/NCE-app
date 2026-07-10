-- File: backend/src/prisma/migrations/20260710111000_harden_cms_public_hierarchy/migration.sql
-- Purpose: Require active CMS ancestors for direct public child-row reads.
-- Why: RLS policies do not inherit page or section activity through foreign keys.

DROP POLICY IF EXISTS cms_sections_public_read ON public.cms_sections;
DROP POLICY IF EXISTS cms_content_items_public_read ON public.cms_content_items;

CREATE POLICY cms_sections_public_read
  ON public.cms_sections FOR SELECT
  TO anon, authenticated
  USING (
    is_active = TRUE
    AND EXISTS (
      SELECT 1
      FROM public.cms_page_contents page
      WHERE page.id = cms_sections.page_id
        AND page.is_active = TRUE
    )
  );

CREATE POLICY cms_content_items_public_read
  ON public.cms_content_items FOR SELECT
  TO anon, authenticated
  USING (
    is_active = TRUE
    AND EXISTS (
      SELECT 1
      FROM public.cms_sections section
      JOIN public.cms_page_contents page ON page.id = section.page_id
      WHERE section.id = cms_content_items.section_id
        AND section.is_active = TRUE
        AND page.is_active = TRUE
    )
  );
