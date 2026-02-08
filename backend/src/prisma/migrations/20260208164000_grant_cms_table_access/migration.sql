-- File: backend/src/prisma/migrations/20260208164000_grant_cms_table_access/migration.sql
-- Purpose: Grant CMS table access for public reads and admin-triggered stat refresh.
-- Why: CMS homepage/about endpoints are public and must be readable by anon/authenticated roles.

GRANT SELECT ON public.cms_page_contents TO anon, authenticated;
GRANT SELECT ON public.cms_sections TO anon, authenticated;
GRANT SELECT ON public.cms_content_items TO anon, authenticated;

-- Stats refresh updates cms_content_items values from backend aggregates.
GRANT UPDATE ON public.cms_content_items TO authenticated;
