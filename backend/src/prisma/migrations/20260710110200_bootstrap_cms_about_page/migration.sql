-- File: backend/src/prisma/migrations/20260710110200_bootstrap_cms_about_page/migration.sql
-- Purpose: Provision a missing About page and its initial rollback baseline.
-- Why: Fresh production databases must not depend on a post-migration CMS seed.

INSERT INTO public.cms_page_contents (page_key, label, is_active, published_at)
SELECT 'about', 'About Page', TRUE, NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM public.cms_page_contents WHERE page_key = 'about'
);

INSERT INTO public.cms_sections (page_id, section_key, label, sort_order, is_active)
SELECT page.id, defaults.section_key, defaults.label, defaults.sort_order, TRUE
FROM public.cms_page_contents page
CROSS JOIN (VALUES
  ('hero', 'Hero Section', 0),
  ('values', 'Our Values', 1),
  ('story', 'Our Story', 2)
) AS defaults(section_key, label, sort_order)
WHERE page.page_key = 'about'
ON CONFLICT (page_id, section_key) DO NOTHING;

WITH defaults(section_key, item_key, sort_order, content_type, content_json) AS (
  VALUES
    ('hero', 'hero_main', 0, 'hero', $cms${
      "title":"About NCE",
      "description":"We're dedicated to helping students achieve their IELTS goals through comprehensive training, expert feedback, and authentic practice materials."
    }$cms$::jsonb),
    ('values', 'value_mission', 0, 'value', $cms${
      "icon":"target","title":"Our Mission",
      "description":"To help students worldwide achieve their target IELTS band scores through expert instruction, authentic materials, and personalized feedback."
    }$cms$::jsonb),
    ('values', 'value_success', 1, 'value', $cms${
      "icon":"heart","title":"Student Success",
      "description":"We prioritize individual learning goals with tailored feedback, regular progress monitoring, and support throughout your IELTS journey."
    }$cms$::jsonb),
    ('values', 'value_instructors', 2, 'value', $cms${
      "icon":"users","title":"Expert Instructors",
      "description":"Our certified IELTS tutors bring years of teaching experience and deep understanding of the test format and scoring criteria."
    }$cms$::jsonb),
    ('values', 'value_results', 3, 'value', $cms${
      "icon":"award","title":"Proven Results",
      "description":"Committed to excellence with a track record of helping students achieve band scores of 7.0 and above consistently."
    }$cms$::jsonb),
    ('story', 'story_p1', 0, 'story_paragraph', $cms${
      "text":"Founded in 2020, NCE was created by IELTS examiners and educators who understood the challenges students face in preparing for this critical test."
    }$cms$::jsonb),
    ('story', 'story_p2', 1, 'story_paragraph', $cms${
      "text":"We developed a comprehensive platform that combines authentic IELTS materials, detailed band score feedback, and personalized learning paths to help students improve efficiently across all four skills."
    }$cms$::jsonb),
    ('story', 'story_p3', 2, 'story_paragraph', $cms${
      "text":"Today, we've helped hundreds of students achieve their target band scores for university admissions, professional registration, and immigration applications worldwide."
    }$cms$::jsonb)
)
INSERT INTO public.cms_content_items (
  section_id, item_key, sort_order, content_type, content_json, is_active
)
SELECT section.id, defaults.item_key, defaults.sort_order,
  defaults.content_type, defaults.content_json, TRUE
FROM defaults
JOIN public.cms_page_contents page ON page.page_key = 'about'
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
    "title":"About NCE",
    "description":"We're dedicated to helping students achieve their IELTS goals through comprehensive training, expert feedback, and authentic practice materials."
  },
  "values":[
    {"icon":"target","title":"Our Mission","description":"To help students worldwide achieve their target IELTS band scores through expert instruction, authentic materials, and personalized feedback."},
    {"icon":"heart","title":"Student Success","description":"We prioritize individual learning goals with tailored feedback, regular progress monitoring, and support throughout your IELTS journey."},
    {"icon":"users","title":"Expert Instructors","description":"Our certified IELTS tutors bring years of teaching experience and deep understanding of the test format and scoring criteria."},
    {"icon":"award","title":"Proven Results","description":"Committed to excellence with a track record of helping students achieve band scores of 7.0 and above consistently."}
  ],
  "story":{"sections":[
    "Founded in 2020, NCE was created by IELTS examiners and educators who understood the challenges students face in preparing for this critical test.",
    "We developed a comprehensive platform that combines authentic IELTS materials, detailed band score feedback, and personalized learning paths to help students improve efficiently across all four skills.",
    "Today, we've helped hundreds of students achieve their target band scores for university admissions, professional registration, and immigration applications worldwide."
  ]}
}$cms$::jsonb, 'publish', NULL
FROM public.cms_page_contents page
WHERE page.page_key = 'about'
  AND NOT EXISTS (
    SELECT 1 FROM public.cms_page_revisions revision WHERE revision.page_id = page.id
  );

UPDATE public.cms_page_contents page
SET published_revision = 1,
    published_at = COALESCE(page.published_at, NOW())
WHERE page.page_key = 'about'
  AND page.published_revision = 0
  AND EXISTS (
    SELECT 1 FROM public.cms_page_revisions revision
    WHERE revision.page_id = page.id AND revision.revision_number = 1
  );
