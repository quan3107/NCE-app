-- File: backend/src/prisma/migrations/20260710103000_secure_cms_admin_writes/migration.sql
-- Purpose: Permit CMS publish writes only for authenticated application administrators.
-- Why: Request-scoped Prisma uses the authenticated database role for admin CMS transactions.

GRANT INSERT, UPDATE, DELETE ON public.cms_sections TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.cms_content_items TO authenticated;

ALTER TABLE public.cms_page_contents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_content_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_page_revisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY cms_page_contents_public_read
  ON public.cms_page_contents FOR SELECT
  TO anon, authenticated
  USING (is_active = true);
CREATE POLICY cms_page_contents_admin_update
  ON public.cms_page_contents FOR UPDATE
  TO authenticated
  USING (current_setting('app.current_user_role', true) = 'admin')
  WITH CHECK (current_setting('app.current_user_role', true) = 'admin');

CREATE POLICY cms_sections_public_read
  ON public.cms_sections FOR SELECT
  TO anon, authenticated
  USING (is_active = true);
CREATE POLICY cms_sections_admin_write
  ON public.cms_sections FOR ALL
  TO authenticated
  USING (current_setting('app.current_user_role', true) = 'admin')
  WITH CHECK (current_setting('app.current_user_role', true) = 'admin');

CREATE POLICY cms_content_items_public_read
  ON public.cms_content_items FOR SELECT
  TO anon, authenticated
  USING (is_active = true);
CREATE POLICY cms_content_items_admin_write
  ON public.cms_content_items FOR ALL
  TO authenticated
  USING (current_setting('app.current_user_role', true) = 'admin')
  WITH CHECK (current_setting('app.current_user_role', true) = 'admin');

CREATE POLICY cms_page_revisions_admin_read
  ON public.cms_page_revisions FOR SELECT
  TO authenticated
  USING (current_setting('app.current_user_role', true) = 'admin');
CREATE POLICY cms_page_revisions_admin_insert
  ON public.cms_page_revisions FOR INSERT
  TO authenticated
  WITH CHECK (current_setting('app.current_user_role', true) = 'admin');
