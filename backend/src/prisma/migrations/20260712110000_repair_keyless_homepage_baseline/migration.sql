-- File: backend/src/prisma/migrations/20260712110000_repair_keyless_homepage_baseline/migration.sql
-- Purpose: Repair empty homepage revision 1 stats created from three legacy keyless rows.
-- Why: Runtime supports this legacy shape, so its baseline revision must remain rollback-safe.

BEGIN;

WITH active_stats AS (
  SELECT
    page.id AS page_id,
    item.item_key,
    item.content_json,
    ROW_NUMBER() OVER (
      PARTITION BY page.id
      ORDER BY item.sort_order, item.id
    ) AS ordinal
  FROM public.cms_page_contents page
  JOIN public.cms_sections section
    ON section.page_id = page.id
   AND section.section_key = 'stats'
   AND section.is_active = TRUE
  JOIN public.cms_content_items item
    ON item.section_id = section.id
   AND item.is_active = TRUE
  WHERE page.page_key = 'homepage'
    AND page.is_active = TRUE
),
eligible_pages AS (
  SELECT page_id
  FROM active_stats
  GROUP BY page_id
  HAVING COUNT(*) = 3
    AND COUNT(*) FILTER (WHERE item_key IS NULL) = 3
),
repaired_stats AS (
  SELECT
    stats.page_id,
    JSONB_AGG(
      stats.content_json || JSONB_BUILD_OBJECT(
        'itemKey',
        CASE stats.ordinal
          WHEN 1 THEN 'stat_students'
          WHEN 2 THEN 'stat_band_score'
          WHEN 3 THEN 'stat_success_rate'
        END
      )
      ORDER BY stats.ordinal
    ) AS content
  FROM active_stats stats
  JOIN eligible_pages eligible ON eligible.page_id = stats.page_id
  GROUP BY stats.page_id
)
UPDATE public.cms_page_revisions revision
SET content_json = JSONB_SET(
  revision.content_json,
  '{stats}',
  repaired_stats.content,
  TRUE
)
FROM repaired_stats
WHERE revision.page_id = repaired_stats.page_id
  AND revision.revision_number = 1
  AND JSONB_TYPEOF(revision.content_json) = 'object'
  AND JSONB_TYPEOF(revision.content_json -> 'stats') = 'array'
  AND JSONB_ARRAY_LENGTH(revision.content_json -> 'stats') = 0;

COMMIT;
