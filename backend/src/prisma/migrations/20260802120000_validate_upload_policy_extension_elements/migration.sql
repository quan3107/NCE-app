-- File: backend/src/prisma/migrations/20260802120000_validate_upload_policy_extension_elements/migration.sql
-- Purpose: Enforce upload extensions as a one-dimensional list of canonical tokens.
-- Why: Serialized array validation can hide null, nested, or comma-packed elements.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE OR REPLACE FUNCTION app.file_upload_extensions_are_valid(candidate TEXT[])
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = pg_catalog
AS $function$
  SELECT COALESCE(
    array_ndims(candidate) = 1
    AND cardinality(candidate) > 0
    AND NOT EXISTS (
      SELECT 1
      FROM unnest(candidate) AS extension
      WHERE extension IS NULL
        OR extension <> LOWER(BTRIM(extension))
        OR extension !~ '^[.][a-z0-9]+$'
    ),
    FALSE
  );
$function$;

ALTER TABLE public.file_upload_allowed_types
DROP CONSTRAINT file_upload_allowed_types_extensions_check;

UPDATE public.file_upload_allowed_types
SET
  extensions = ARRAY(
    SELECT DISTINCT LOWER(BTRIM(extension))
    FROM UNNEST(extensions) AS extension
    WHERE extension IS NOT NULL
      AND LOWER(BTRIM(extension)) ~ '^[.][a-z0-9]+$'
    ORDER BY 1
  ),
  updated_at = NOW();

DELETE FROM public.file_upload_allowed_types
WHERE NOT app.file_upload_extensions_are_valid(extensions);

-- Restore the safe baseline if every legacy type for a role was malformed.
WITH default_allowed_types AS (
  SELECT *
  FROM (VALUES
    ('application/pdf', ARRAY['.pdf']::TEXT[], 'PDF Document', '.pdf', 1),
    ('application/msword', ARRAY['.doc']::TEXT[], 'Word Document', '.doc', 2),
    (
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ARRAY['.docx']::TEXT[], 'Word Document', '.docx', 3
    ),
    (
      'audio/*', ARRAY['.aac', '.flac', '.m4a', '.mp3', '.ogg', '.wav', '.webm']::TEXT[],
      'Audio Files', 'audio/*', 4
    ),
    (
      'image/*', ARRAY['.gif', '.jpeg', '.jpg', '.png', '.svg', '.webp']::TEXT[],
      'Image Files', 'image/*', 5
    )
  ) AS defaults(mime_type, extensions, label, accept_token, sort_order)
)
INSERT INTO public.file_upload_allowed_types (
  policy_id, mime_type, extensions, label, accept_token, sort_order
)
SELECT
  policy.id, defaults.mime_type, defaults.extensions, defaults.label,
  defaults.accept_token, defaults.sort_order
FROM public.file_upload_policies AS policy
CROSS JOIN default_allowed_types AS defaults
WHERE NOT EXISTS (
  SELECT 1
  FROM public.file_upload_allowed_types AS existing
  WHERE existing.policy_id = policy.id
);

ALTER TABLE public.file_upload_allowed_types
ADD CONSTRAINT file_upload_allowed_types_extensions_check
CHECK (app.file_upload_extensions_are_valid(extensions));

COMMIT;
