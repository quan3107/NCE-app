-- File: backend/src/prisma/migrations/20260710110100_bootstrap_cms_homepage/migration.sql
-- Purpose: Provision a missing homepage and its initial rollback baseline.
-- Why: Fresh production databases must not depend on a post-migration CMS seed.

INSERT INTO public.cms_page_contents (page_key, label, is_active, published_at)
SELECT 'homepage', 'Homepage', TRUE, NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM public.cms_page_contents WHERE page_key = 'homepage'
);

INSERT INTO public.cms_sections (page_id, section_key, label, sort_order, is_active)
SELECT page.id, defaults.section_key, defaults.label, defaults.sort_order, TRUE
FROM public.cms_page_contents page
CROSS JOIN (VALUES
  ('hero', 'Hero Section', 0),
  ('stats', 'Statistics', 1),
  ('features', 'How It Works', 2)
) AS defaults(section_key, label, sort_order)
WHERE page.page_key = 'homepage'
ON CONFLICT (page_id, section_key) DO NOTHING;

WITH defaults(section_key, item_key, sort_order, content_type, content_json) AS (
  VALUES
    ('hero', 'hero_main', 0, 'hero', $cms${
      "badge":"Professional IELTS Training",
      "title":"Achieve Your Target IELTS Band Score",
      "description":"Master all four IELTS skills with expert tutors, authentic practice materials, and personalized feedback. Get the band score you need for university admission, immigration, or career advancement.",
      "cta_primary":"View Courses",
      "cta_secondary":"Teacher Login"
    }$cms$::jsonb),
    ('stats', 'stat_students', 0, 'stat', $cms${
      "label":"Active Students","value":1250,"format":"number","suffix":"+"
    }$cms$::jsonb),
    ('stats', 'stat_band_score', 1, 'stat', $cms${
      "label":"Average Band Score","value":7.5,"format":"decimal"
    }$cms$::jsonb),
    ('stats', 'stat_success_rate', 2, 'stat', $cms${
      "label":"Success Rate","value":0.92,"format":"percentage"
    }$cms$::jsonb),
    ('features', 'section_meta', 0, 'section_meta', $cms${
      "title":"How It Works",
      "description":"Our structured approach helps you improve systematically across all IELTS test components with expert guidance every step of the way."
    }$cms$::jsonb),
    ('features', 'feature_practice', 1, 'feature', $cms${
      "icon":"book-open","title":"IELTS Practice Tasks",
      "description":"Authentic IELTS practice materials for all four skills - Reading, Writing, Listening, and Speaking."
    }$cms$::jsonb),
    ('features', 'feature_feedback', 2, 'feature', $cms${
      "icon":"users","title":"Expert Feedback",
      "description":"Receive detailed feedback from certified IELTS instructors on every submission with band score evaluations."
    }$cms$::jsonb),
    ('features', 'feature_progress', 3, 'feature', $cms${
      "icon":"trending-up","title":"Track Your Progress",
      "description":"Monitor your band scores across all skills and identify areas for improvement with detailed analytics."
    }$cms$::jsonb)
)
INSERT INTO public.cms_content_items (
  section_id, item_key, sort_order, content_type, content_json, is_active
)
SELECT section.id, defaults.item_key, defaults.sort_order,
  defaults.content_type, defaults.content_json, TRUE
FROM defaults
JOIN public.cms_page_contents page ON page.page_key = 'homepage'
JOIN public.cms_sections section
  ON section.page_id = page.id AND section.section_key = defaults.section_key
WHERE NOT EXISTS (
  SELECT 1 FROM public.cms_content_items existing
  WHERE existing.section_id = section.id AND existing.item_key = defaults.item_key
);

INSERT INTO public.cms_page_revisions (
  page_id, revision_number, content_json, operation, created_by_id
)
SELECT page.id, 1, $cms${
  "hero":{
    "badge":"Professional IELTS Training",
    "title":"Achieve Your Target IELTS Band Score",
    "description":"Master all four IELTS skills with expert tutors, authentic practice materials, and personalized feedback. Get the band score you need for university admission, immigration, or career advancement.",
    "cta_primary":"View Courses","cta_secondary":"Teacher Login"
  },
  "stats":[
    {"label":"Active Students","value":1250,"format":"number","suffix":"+"},
    {"label":"Average Band Score","value":7.5,"format":"decimal"},
    {"label":"Success Rate","value":0.92,"format":"percentage"}
  ],
  "howItWorks":{
    "title":"How It Works",
    "description":"Our structured approach helps you improve systematically across all IELTS test components with expert guidance every step of the way.",
    "features":[
      {"icon":"book-open","title":"IELTS Practice Tasks","description":"Authentic IELTS practice materials for all four skills - Reading, Writing, Listening, and Speaking."},
      {"icon":"users","title":"Expert Feedback","description":"Receive detailed feedback from certified IELTS instructors on every submission with band score evaluations."},
      {"icon":"trending-up","title":"Track Your Progress","description":"Monitor your band scores across all skills and identify areas for improvement with detailed analytics."}
    ]
  }
}$cms$::jsonb, 'publish', NULL
FROM public.cms_page_contents page
WHERE page.page_key = 'homepage'
  AND NOT EXISTS (
    SELECT 1 FROM public.cms_page_revisions revision WHERE revision.page_id = page.id
  );

UPDATE public.cms_page_contents page
SET published_revision = 1,
    published_at = COALESCE(page.published_at, NOW())
WHERE page.page_key = 'homepage'
  AND page.published_revision = 0
  AND EXISTS (
    SELECT 1 FROM public.cms_page_revisions revision
    WHERE revision.page_id = page.id AND revision.revision_number = 1
  );
