-- File: backend/src/prisma/migrations/20260729150000_repair_upload_policy_storage/migration.sql
-- Purpose: Repair upload-policy rows and enforce canonical whole-MiB storage.
-- Why: Every stored policy must remain readable and usable as a compare-and-swap baseline.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- Restore any missing supported role before validating the complete policy set.
INSERT INTO public.file_upload_policies (
  role,
  max_file_size,
  max_total_size,
  max_files_per_upload
)
VALUES
  ('student'::"UserRole", 26214400, 104857600, 5),
  ('teacher'::"UserRole", 26214400, 104857600, 5),
  ('admin'::"UserRole", 26214400, 104857600, 5)
ON CONFLICT (role) DO NOTHING;

-- Round legacy fractional-MiB values to the nearest MiB and clamp the API range.
UPDATE public.file_upload_policies
SET
  max_file_size = (
    LEAST(
      100,
      GREATEST(1, ROUND(max_file_size::NUMERIC / 1048576))
    )::INTEGER * 1048576
  ),
  updated_at = NOW()
WHERE
  max_file_size NOT BETWEEN 1048576 AND 104857600
  OR max_file_size % 1048576 <> 0;

-- A restored role needs the same default allowed types as the baseline migration.
WITH default_allowed_types AS (
  SELECT *
  FROM (VALUES
    ('application/pdf', ARRAY['.pdf']::TEXT[], 'PDF Document', '.pdf', 1),
    ('application/msword', ARRAY['.doc']::TEXT[], 'Word Document', '.doc', 2),
    (
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ARRAY['.docx']::TEXT[],
      'Word Document',
      '.docx',
      3
    ),
    (
      'audio/*',
      ARRAY['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac', '.webm']::TEXT[],
      'Audio Files',
      'audio/*',
      4
    ),
    (
      'image/*',
      ARRAY['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']::TEXT[],
      'Image Files',
      'image/*',
      5
    )
  ) AS defaults(mime_type, extensions, label, accept_token, sort_order)
)
INSERT INTO public.file_upload_allowed_types (
  policy_id,
  mime_type,
  extensions,
  label,
  accept_token,
  sort_order
)
SELECT
  policy.id,
  defaults.mime_type,
  defaults.extensions,
  defaults.label,
  defaults.accept_token,
  defaults.sort_order
FROM public.file_upload_policies policy
CROSS JOIN default_allowed_types defaults
WHERE policy.role IN (
  'student'::"UserRole",
  'teacher'::"UserRole",
  'admin'::"UserRole"
)
ON CONFLICT (policy_id, accept_token) DO NOTHING;

ALTER TABLE public.file_upload_policies
ADD CONSTRAINT file_upload_policies_max_file_size_canonical_check
CHECK (
  max_file_size BETWEEN 1048576 AND 104857600
  AND max_file_size % 1048576 = 0
);

COMMIT;
