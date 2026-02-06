-- File: backend/src/prisma/migrations/20260206203000_add_file_upload_config/migration.sql
-- Purpose: Add role-based file upload configuration tables and baseline defaults.
-- Why: Replace hardcoded frontend upload validation with backend-managed policy.

CREATE TABLE public.file_upload_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role "UserRole" NOT NULL UNIQUE,
  max_file_size INTEGER NOT NULL,
  max_total_size INTEGER NOT NULL,
  max_files_per_upload INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.file_upload_allowed_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id UUID NOT NULL REFERENCES public.file_upload_policies(id) ON DELETE CASCADE,
  mime_type TEXT NOT NULL,
  extensions TEXT[] NOT NULL,
  label TEXT NOT NULL,
  accept_token TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT file_upload_allowed_types_policy_token_key UNIQUE (policy_id, accept_token)
);

CREATE INDEX file_upload_allowed_types_policy_sort_idx
  ON public.file_upload_allowed_types(policy_id, sort_order);

-- Baseline policy: keep current production behavior for every role.
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
ON CONFLICT (role)
DO UPDATE SET
  max_file_size = EXCLUDED.max_file_size,
  max_total_size = EXCLUDED.max_total_size,
  max_files_per_upload = EXCLUDED.max_files_per_upload,
  updated_at = NOW();

-- Re-seed allowed types for the baseline policies.
DELETE FROM public.file_upload_allowed_types
USING public.file_upload_policies
WHERE public.file_upload_allowed_types.policy_id = public.file_upload_policies.id
  AND public.file_upload_policies.role IN (
    'student'::"UserRole",
    'teacher'::"UserRole",
    'admin'::"UserRole"
  );

WITH target_policies AS (
  SELECT id
  FROM public.file_upload_policies
  WHERE role IN (
    'student'::"UserRole",
    'teacher'::"UserRole",
    'admin'::"UserRole"
  )
),
default_allowed_types AS (
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
    ('audio/*', ARRAY['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac', '.webm']::TEXT[], 'Audio Files', 'audio/*', 4),
    ('image/*', ARRAY['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']::TEXT[], 'Image Files', 'image/*', 5)
  ) AS t(mime_type, extensions, label, accept_token, sort_order)
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
  p.id,
  d.mime_type,
  d.extensions,
  d.label,
  d.accept_token,
  d.sort_order
FROM target_policies p
CROSS JOIN default_allowed_types d;

GRANT SELECT ON
  public.file_upload_policies,
  public.file_upload_allowed_types
TO authenticated;
