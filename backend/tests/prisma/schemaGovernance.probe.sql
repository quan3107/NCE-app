-- File: backend/tests/prisma/schemaGovernance.probe.sql
-- Purpose: Verify replay prerequisites, structural integrity, and database-only exceptions.
-- Why: Prisma diff does not cover roles, extensions, partial indexes, or CMS data invariants.

DO $$
DECLARE
  required_role text;
BEGIN
  FOREACH required_role IN ARRAY ARRAY[
    'anon', 'authenticated', 'service_role', 'authenticator', 'postgres',
    'nce_runtime', 'nce_job_runner', 'nce_app_anon', 'nce_app_authenticated'
  ] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = required_role) THEN
      RAISE EXCEPTION 'required role is missing: %', required_role;
    END IF;
  END LOOP;

  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'citext') THEN
    RAISE EXCEPTION 'required citext extension is missing';
  END IF;
END
$$;

DO $$
DECLARE
  missing_initial_detected boolean;
  valid_sequence_rejected boolean;
BEGIN
  WITH revision_order AS (
    SELECT revision_number,
      row_number() OVER (ORDER BY revision_number) AS expected_revision
    FROM unnest(ARRAY[2, 3]) AS revision_number
  )
  SELECT EXISTS (
    SELECT 1 FROM revision_order
    WHERE revision_number <> expected_revision
  ) INTO missing_initial_detected;

  WITH revision_order AS (
    SELECT revision_number,
      row_number() OVER (ORDER BY revision_number) AS expected_revision
    FROM unnest(ARRAY[1, 2, 3]) AS revision_number
  )
  SELECT EXISTS (
    SELECT 1 FROM revision_order
    WHERE revision_number <> expected_revision
  ) INTO valid_sequence_rejected;

  IF NOT missing_initial_detected OR valid_sequence_rejected THEN
    RAISE EXCEPTION 'CMS revision-contiguity probe regression';
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_index index_state
    JOIN pg_class index_class ON index_class.oid = index_state.indexrelid
    JOIN pg_namespace namespace ON namespace.oid = index_class.relnamespace
    WHERE namespace.nspname = 'public'
      AND (NOT index_state.indisvalid OR NOT index_state.indisready)
  ) THEN
    RAISE EXCEPTION 'public schema contains an invalid or unready index';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint constraint_state
    JOIN pg_namespace namespace ON namespace.oid = constraint_state.connamespace
    WHERE namespace.nspname = 'public' AND NOT constraint_state.convalidated
  ) THEN
    RAISE EXCEPTION 'public schema contains an unvalidated constraint';
  END IF;
END
$$;

DO $$
DECLARE
  uncovered_count integer;
BEGIN
  WITH foreign_keys AS (
    SELECT constraint_state.oid, constraint_state.conrelid,
      constraint_state.conname, constraint_state.conkey
    FROM pg_constraint constraint_state
    JOIN pg_class table_class ON table_class.oid = constraint_state.conrelid
    JOIN pg_namespace namespace ON namespace.oid = table_class.relnamespace
    WHERE constraint_state.contype = 'f' AND namespace.nspname = 'public'
  )
  SELECT count(*) INTO uncovered_count
  FROM foreign_keys foreign_key
  WHERE foreign_key.conname <> 'navigation_items_parent_id_fkey'
    AND NOT EXISTS (
      SELECT 1
      FROM pg_index index_state
      WHERE index_state.indrelid = foreign_key.conrelid
        AND index_state.indisvalid
        AND index_state.indisready
        AND index_state.indpred IS NULL
        AND (index_state.indkey::smallint[])[0:cardinality(foreign_key.conkey) - 1]
          = foreign_key.conkey
    );

  IF uncovered_count <> 0 THEN
    RAISE EXCEPTION '% public foreign keys lack a leading index', uncovered_count;
  END IF;

  IF to_regclass('public.idx_navigation_items_parent_id') IS NULL OR
    pg_get_indexdef(to_regclass('public.idx_navigation_items_parent_id'))
      NOT LIKE '%(parent_id) WHERE (parent_id IS NOT NULL)' THEN
    RAISE EXCEPTION 'navigation parent partial index is missing or changed';
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.cms_sections section_row
    LEFT JOIN public.cms_page_contents page_row ON page_row.id = section_row.page_id
    WHERE page_row.id IS NULL
  ) OR EXISTS (
    SELECT 1 FROM public.cms_content_items item_row
    LEFT JOIN public.cms_sections section_row ON section_row.id = item_row.section_id
    WHERE section_row.id IS NULL
  ) THEN
    RAISE EXCEPTION 'CMS hierarchy contains orphan rows';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM (
      SELECT page_id, revision_number,
        row_number() OVER (
          PARTITION BY page_id ORDER BY revision_number
        ) AS expected_revision
      FROM public.cms_page_revisions
    ) revision_order
    WHERE revision_number <> expected_revision
  ) THEN
    RAISE EXCEPTION 'CMS revision history contains a gap';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.cms_page_revisions rollback_revision
    JOIN public.cms_page_revisions source_revision
      ON source_revision.id = rollback_revision.source_revision_id
    WHERE source_revision.page_id <> rollback_revision.page_id
  ) THEN
    RAISE EXCEPTION 'CMS rollback source belongs to another page';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.cms_page_contents page_row
    WHERE page_row.published_draft_version > page_row.draft_version
      OR page_row.published_revision < 0
      OR (page_row.published_at IS NULL) <> (page_row.published_revision = 0)
      OR page_row.published_revision <> COALESCE((
        SELECT max(revision_row.revision_number)
        FROM public.cms_page_revisions revision_row
        WHERE revision_row.page_id = page_row.id
      ), 0)
  ) THEN
    RAISE EXCEPTION 'CMS publication versions are inconsistent';
  END IF;
END
$$;
