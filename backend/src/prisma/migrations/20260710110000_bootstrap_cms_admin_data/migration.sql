-- File: backend/src/prisma/migrations/20260710110000_bootstrap_cms_admin_data/migration.sql
-- Purpose: Provision required CMS admin data and preserve current published pages as revision 1.
-- Why: Production migrate deploy must be sufficient without destructive runtime seed scripts.

WITH inserted_page AS (
  INSERT INTO public.cms_page_contents (page_key, label, is_active, published_at)
  SELECT 'contact', 'Contact Page', TRUE, NOW()
  WHERE NOT EXISTS (
    SELECT 1 FROM public.cms_page_contents WHERE page_key = 'contact'
  )
  RETURNING id
), contact_page AS (
  SELECT id FROM inserted_page
  UNION ALL
  SELECT id FROM public.cms_page_contents WHERE page_key = 'contact'
  LIMIT 1
)
INSERT INTO public.cms_sections (page_id, section_key, label, sort_order, is_active)
SELECT contact_page.id, section_key, label, sort_order, TRUE
FROM contact_page
CROSS JOIN (VALUES
  ('header', 'Page Header', 0),
  ('form', 'Contact Form', 1),
  ('details', 'Contact Information', 2),
  ('hours', 'Office Hours', 3)
) AS defaults(section_key, label, sort_order)
ON CONFLICT (page_id, section_key) DO NOTHING;

WITH contact_items(section_key, item_key, sort_order, content_type, content_json) AS (
  VALUES
    ('header', 'header_main', 0, 'header', jsonb_build_object(
      'title', 'Contact Us',
      'description', 'Have questions about our IELTS courses or need guidance? We''d love to hear from you. Send us a message and we''ll respond within 24 hours.'
    )),
    ('form', 'form_main', 0, 'form', jsonb_build_object(
      'title', 'Send us a message',
      'description', 'Whether you''re interested in our IELTS courses or have questions about the test, we''re here to help.',
      'submitLabel', 'Send Message'
    )),
    ('details', 'details_main', 0, 'contact_details', jsonb_build_object(
      'email', 'support@nce.com',
      'phone', '+1 (555) 123-4567',
      'address', E'123 Education Street\nBangkok, Thailand 10110'
    )),
    ('hours', 'hours_1', 0, 'office_hours', jsonb_build_object(
      'label', 'Monday - Friday', 'value', '9:00 AM - 6:00 PM'
    )),
    ('hours', 'hours_2', 1, 'office_hours', jsonb_build_object(
      'label', 'Saturday', 'value', '10:00 AM - 2:00 PM'
    )),
    ('hours', 'hours_3', 2, 'office_hours', jsonb_build_object(
      'label', 'Sunday', 'value', 'Closed'
    ))
)
INSERT INTO public.cms_content_items (
  section_id, item_key, sort_order, content_type, content_json, is_active
)
SELECT section.id, item.item_key, item.sort_order, item.content_type, item.content_json, TRUE
FROM contact_items item
JOIN public.cms_page_contents page ON page.page_key = 'contact'
JOIN public.cms_sections section
  ON section.page_id = page.id AND section.section_key = item.section_key
WHERE NOT EXISTS (
  SELECT 1
  FROM public.cms_content_items existing
  WHERE existing.section_id = section.id AND existing.item_key = item.item_key
);

INSERT INTO public.permissions (key, name)
VALUES ('cms:manage', 'Manage CMS Content')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.role_permissions (role, permission_id)
SELECT 'admin', id FROM public.permissions WHERE key = 'cms:manage'
ON CONFLICT DO NOTHING;

INSERT INTO public.navigation_items (
  role, label, path, icon_name, required_permission, order_index,
  badge_source, parent_id, is_active, feature_flag
)
SELECT
  'admin', 'Content', '/admin/content', 'file-pen-line', 'cms:manage', 5,
  NULL, NULL, TRUE, NULL
WHERE NOT EXISTS (
  SELECT 1
  FROM public.navigation_items
  WHERE role = 'admin' AND path = '/admin/content'
);

WITH managed_pages AS (
  SELECT id, page_key
  FROM public.cms_page_contents
  WHERE is_active = TRUE AND page_key IN ('homepage', 'about', 'contact')
), snapshots AS (
  SELECT page.id, CASE page.page_key
    WHEN 'homepage' THEN jsonb_build_object(
      'hero', COALESCE((
        SELECT item.content_json
        FROM public.cms_sections section
        JOIN public.cms_content_items item ON item.section_id = section.id
        WHERE section.page_id = page.id AND section.section_key = 'hero'
          AND section.is_active = TRUE AND item.is_active = TRUE
        ORDER BY item.sort_order LIMIT 1
      ), '{}'::jsonb),
      'stats', COALESCE((
        SELECT jsonb_agg(item.content_json ORDER BY item.sort_order)
        FROM public.cms_sections section
        JOIN public.cms_content_items item ON item.section_id = section.id
        WHERE section.page_id = page.id AND section.section_key = 'stats'
          AND section.is_active = TRUE AND item.is_active = TRUE
      ), '[]'::jsonb),
      'howItWorks', jsonb_build_object(
        'title', COALESCE((
          SELECT item.content_json ->> 'title'
          FROM public.cms_sections section
          JOIN public.cms_content_items item ON item.section_id = section.id
          WHERE section.page_id = page.id AND section.section_key = 'features'
            AND section.is_active = TRUE AND item.is_active = TRUE
            AND (item.content_type = 'section_meta' OR item.item_key = 'section_meta')
          ORDER BY item.sort_order LIMIT 1
        ), (
          SELECT section.label FROM public.cms_sections section
          WHERE section.page_id = page.id AND section.section_key = 'features'
            AND section.is_active = TRUE LIMIT 1
        ), 'How It Works'),
        'description', COALESCE((
          SELECT item.content_json ->> 'description'
          FROM public.cms_sections section
          JOIN public.cms_content_items item ON item.section_id = section.id
          WHERE section.page_id = page.id AND section.section_key = 'features'
            AND section.is_active = TRUE AND item.is_active = TRUE
            AND (item.content_type = 'section_meta' OR item.item_key = 'section_meta')
          ORDER BY item.sort_order LIMIT 1
        ), 'Our structured approach helps you improve systematically across all IELTS test components with expert guidance every step of the way.'),
        'features', COALESCE((
          SELECT jsonb_agg(item.content_json ORDER BY item.sort_order)
          FROM public.cms_sections section
          JOIN public.cms_content_items item ON item.section_id = section.id
          WHERE section.page_id = page.id AND section.section_key = 'features'
            AND section.is_active = TRUE AND item.is_active = TRUE
            AND item.content_type = 'feature' AND item.item_key IS DISTINCT FROM 'section_meta'
        ), '[]'::jsonb)
      )
    )
    WHEN 'about' THEN jsonb_build_object(
      'hero', COALESCE((
        SELECT item.content_json
        FROM public.cms_sections section
        JOIN public.cms_content_items item ON item.section_id = section.id
        WHERE section.page_id = page.id AND section.section_key = 'hero'
          AND section.is_active = TRUE AND item.is_active = TRUE
        ORDER BY item.sort_order LIMIT 1
      ), '{}'::jsonb),
      'values', COALESCE((
        SELECT jsonb_agg(item.content_json ORDER BY item.sort_order)
        FROM public.cms_sections section
        JOIN public.cms_content_items item ON item.section_id = section.id
        WHERE section.page_id = page.id AND section.section_key = 'values'
          AND section.is_active = TRUE AND item.is_active = TRUE
      ), '[]'::jsonb),
      'story', jsonb_build_object('sections', COALESCE((
        SELECT jsonb_agg(item.content_json -> 'text' ORDER BY item.sort_order)
        FROM public.cms_sections section
        JOIN public.cms_content_items item ON item.section_id = section.id
        WHERE section.page_id = page.id AND section.section_key = 'story'
          AND section.is_active = TRUE AND item.is_active = TRUE
      ), '[]'::jsonb))
    )
    WHEN 'contact' THEN jsonb_build_object(
      'header', COALESCE((
        SELECT item.content_json FROM public.cms_sections section
        JOIN public.cms_content_items item ON item.section_id = section.id
        WHERE section.page_id = page.id AND section.section_key = 'header'
          AND section.is_active = TRUE AND item.is_active = TRUE
        ORDER BY item.sort_order LIMIT 1
      ), '{}'::jsonb),
      'form', COALESCE((
        SELECT item.content_json FROM public.cms_sections section
        JOIN public.cms_content_items item ON item.section_id = section.id
        WHERE section.page_id = page.id AND section.section_key = 'form'
          AND section.is_active = TRUE AND item.is_active = TRUE
        ORDER BY item.sort_order LIMIT 1
      ), '{}'::jsonb),
      'details', COALESCE((
        SELECT item.content_json FROM public.cms_sections section
        JOIN public.cms_content_items item ON item.section_id = section.id
        WHERE section.page_id = page.id AND section.section_key = 'details'
          AND section.is_active = TRUE AND item.is_active = TRUE
        ORDER BY item.sort_order LIMIT 1
      ), '{}'::jsonb),
      'hours', COALESCE((
        SELECT jsonb_agg(item.content_json ORDER BY item.sort_order)
        FROM public.cms_sections section
        JOIN public.cms_content_items item ON item.section_id = section.id
        WHERE section.page_id = page.id AND section.section_key = 'hours'
          AND section.is_active = TRUE AND item.is_active = TRUE
      ), '[]'::jsonb)
    )
  END AS content_json
  FROM managed_pages page
)
INSERT INTO public.cms_page_revisions (
  page_id, revision_number, content_json, operation, created_by_id
)
SELECT snapshot.id, 1, snapshot.content_json, 'publish', NULL
FROM snapshots snapshot
WHERE NOT EXISTS (
  SELECT 1 FROM public.cms_page_revisions revision WHERE revision.page_id = snapshot.id
);

UPDATE public.cms_page_contents page
SET published_revision = 1
WHERE page.published_revision = 0
  AND EXISTS (
    SELECT 1 FROM public.cms_page_revisions revision
    WHERE revision.page_id = page.id AND revision.revision_number = 1
  );
