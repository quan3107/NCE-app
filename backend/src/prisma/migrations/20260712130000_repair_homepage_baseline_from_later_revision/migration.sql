-- File: backend/src/prisma/migrations/20260712130000_repair_homepage_baseline_from_later_revision/migration.sql
-- Purpose: Repair empty homepage baselines after an intervening publish canonicalized live stats.
-- Why: The earliest later valid revision preserves historical values better than current rows.

BEGIN;

WITH invalid_baselines AS (
  SELECT
    baseline.id AS revision_id,
    baseline.page_id,
    baseline.content_json
  FROM public.cms_page_revisions baseline
  JOIN public.cms_page_contents page ON page.id = baseline.page_id
  WHERE page.page_key = 'homepage'
    AND baseline.revision_number = 1
    AND JSONB_TYPEOF(baseline.content_json) = 'object'
    AND JSONB_TYPEOF(baseline.content_json -> 'stats') = 'array'
    AND JSONB_ARRAY_LENGTH(baseline.content_json -> 'stats') = 0
),
valid_later_stats AS (
  SELECT
    baseline.page_id,
    later.revision_number,
    later.content_json -> 'stats' AS stats,
    ROW_NUMBER() OVER (
      PARTITION BY baseline.page_id
      ORDER BY later.revision_number
    ) AS candidate_order
  FROM invalid_baselines baseline
  JOIN public.cms_page_revisions later
    ON later.page_id = baseline.page_id
   AND later.revision_number > 1
  WHERE JSONB_TYPEOF(later.content_json) = 'object'
    AND JSONB_TYPEOF(later.content_json -> 'stats') = 'array'
    AND JSONB_ARRAY_LENGTH(later.content_json -> 'stats') = 3
    AND (
      SELECT
        COUNT(*) = 3
        AND COUNT(DISTINCT stat ->> 'itemKey') = 3
        AND BOOL_AND(
          JSONB_TYPEOF(stat) = 'object'
          AND stat ->> 'itemKey' IN (
            'stat_students',
            'stat_band_score',
            'stat_success_rate'
          )
          AND JSONB_TYPEOF(stat -> 'label') = 'string'
          AND BTRIM(stat ->> 'label') <> ''
          AND JSONB_TYPEOF(stat -> 'value') = 'number'
          AND stat ->> 'format' IN ('number', 'decimal', 'percentage')
          AND (
            NOT stat ? 'suffix'
            OR JSONB_TYPEOF(stat -> 'suffix') = 'string'
          )
        )
      FROM JSONB_ARRAY_ELEMENTS(later.content_json -> 'stats') stat
    )
),
earliest_later_stats AS (
  SELECT page_id, stats
  FROM valid_later_stats
  WHERE candidate_order = 1
),
current_modeled_stats AS (
  SELECT
    baseline.page_id,
    item.item_key,
    item.content_json,
    item.sort_order,
    item.id
  FROM invalid_baselines baseline
  JOIN public.cms_sections section
    ON section.page_id = baseline.page_id
   AND section.section_key = 'stats'
   AND section.is_active = TRUE
  JOIN public.cms_content_items item
    ON item.section_id = section.id
   AND item.is_active = TRUE
  WHERE item.item_key IS NULL
    OR item.item_key IN (
      'stat_students',
      'stat_band_score',
      'stat_success_rate'
    )
),
current_fallback_stats AS (
  SELECT
    page_id,
    JSONB_AGG(
      content_json || JSONB_BUILD_OBJECT('itemKey', item_key)
      ORDER BY sort_order, id
    ) AS stats
  FROM current_modeled_stats
  GROUP BY page_id
  HAVING COUNT(*) = 3
    AND COUNT(item_key) = 3
    AND COUNT(DISTINCT item_key) = 3
    AND BOOL_AND(
      item_key IN (
        'stat_students',
        'stat_band_score',
        'stat_success_rate'
      )
      AND JSONB_TYPEOF(content_json) = 'object'
      AND JSONB_TYPEOF(content_json -> 'label') = 'string'
      AND BTRIM(content_json ->> 'label') <> ''
      AND JSONB_TYPEOF(content_json -> 'value') = 'number'
      AND content_json ->> 'format' IN ('number', 'decimal', 'percentage')
      AND (
        NOT content_json ? 'suffix'
        OR JSONB_TYPEOF(content_json -> 'suffix') = 'string'
      )
    )
),
repair_sources AS (
  SELECT
    baseline.revision_id,
    COALESCE(later.stats, fallback.stats) AS stats
  FROM invalid_baselines baseline
  LEFT JOIN earliest_later_stats later ON later.page_id = baseline.page_id
  LEFT JOIN current_fallback_stats fallback ON fallback.page_id = baseline.page_id
  WHERE COALESCE(later.stats, fallback.stats) IS NOT NULL
)
UPDATE public.cms_page_revisions baseline
SET content_json = JSONB_SET(
  baseline.content_json,
  '{stats}',
  source.stats,
  TRUE
)
FROM repair_sources source
WHERE baseline.id = source.revision_id;

COMMIT;
