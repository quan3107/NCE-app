-- File: backend/src/prisma/migrations/20260802100000_validate_upload_policy_types/migration.sql
-- Purpose: Repair and constrain normalized file-upload allow-list fields.
-- Why: Blank or malformed policy values must never authorize an upload.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- Canonical token collisions can exist because the old unique key was case-sensitive.
-- Keep a candidate that will survive normalization and validation whenever one exists.
WITH normalized_candidates AS (
  SELECT
    allowed_type.id,
    allowed_type.policy_id,
    allowed_type.sort_order,
    allowed_type.created_at,
    LOWER(BTRIM(allowed_type.accept_token)) AS canonical_accept_token,
    (
      LOWER(BTRIM(allowed_type.mime_type))
        ~ '^[a-z0-9!#$&^_.+-]+/([a-z0-9!#$&^_.+-]+|[*])$'
      AND COALESCE(
        array_to_string(
          ARRAY(
            SELECT DISTINCT LOWER(BTRIM(extension))
            FROM UNNEST(allowed_type.extensions) AS extension
            WHERE LOWER(BTRIM(extension)) ~ '^[.][a-z0-9]+$'
            ORDER BY 1
          ),
          ','
        ),
        ''
      ) ~ '^([.][a-z0-9]+)(,[.][a-z0-9]+)*$'
      AND BTRIM(allowed_type.label) <> ''
      AND LOWER(BTRIM(allowed_type.accept_token))
        ~ '^([.][a-z0-9]+|[a-z0-9!#$&^_.+-]+/([a-z0-9!#$&^_.+-]+|[*]))$'
    ) AS is_valid
  FROM public.file_upload_allowed_types AS allowed_type
),
ranked_tokens AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY policy_id, canonical_accept_token
      ORDER BY is_valid DESC NULLS LAST, sort_order, created_at, id
    ) AS duplicate_rank
  FROM normalized_candidates
)
DELETE FROM public.file_upload_allowed_types AS allowed_type
USING ranked_tokens
WHERE allowed_type.id = ranked_tokens.id
  AND ranked_tokens.duplicate_rank > 1;

UPDATE public.file_upload_allowed_types
SET
  mime_type = LOWER(BTRIM(mime_type)),
  extensions = ARRAY(
    SELECT DISTINCT LOWER(BTRIM(extension))
    FROM UNNEST(extensions) AS extension
    WHERE LOWER(BTRIM(extension)) ~ '^[.][a-z0-9]+$'
    ORDER BY 1
  ),
  label = BTRIM(label),
  accept_token = LOWER(BTRIM(accept_token)),
  updated_at = NOW();

DELETE FROM public.file_upload_allowed_types
WHERE
  mime_type !~ '^[a-z0-9!#$&^_.+-]+/([a-z0-9!#$&^_.+-]+|[*])$'
  OR COALESCE(array_to_string(extensions, ','), '')
    !~ '^([.][a-z0-9]+)(,[.][a-z0-9]+)*$'
  OR label = ''
  OR accept_token
    !~ '^([.][a-z0-9]+|[a-z0-9!#$&^_.+-]+/([a-z0-9!#$&^_.+-]+|[*]))$';

-- A fully corrupt legacy role is restored to the safe baseline allow list.
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
ADD CONSTRAINT file_upload_allowed_types_mime_type_check
CHECK (
  mime_type = LOWER(BTRIM(mime_type))
  AND mime_type ~ '^[a-z0-9!#$&^_.+-]+/([a-z0-9!#$&^_.+-]+|[*])$'
),
ADD CONSTRAINT file_upload_allowed_types_extensions_check
CHECK (
  COALESCE(array_to_string(extensions, ','), '')
    ~ '^([.][a-z0-9]+)(,[.][a-z0-9]+)*$'
),
ADD CONSTRAINT file_upload_allowed_types_label_check
CHECK (label = BTRIM(label) AND label <> ''),
ADD CONSTRAINT file_upload_allowed_types_accept_token_check
CHECK (
  accept_token = LOWER(BTRIM(accept_token))
  AND accept_token
    ~ '^([.][a-z0-9]+|[a-z0-9!#$&^_.+-]+/([a-z0-9!#$&^_.+-]+|[*]))$'
);

COMMIT;
