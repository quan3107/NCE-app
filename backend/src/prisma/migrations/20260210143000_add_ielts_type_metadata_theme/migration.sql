-- File: backend/src/prisma/migrations/20260210143000_add_ielts_type_metadata_theme/migration.sql
-- Purpose: Add IELTS type card theme metadata to assignment type configuration rows.
-- Why: Supports backend-driven UI card theming for IELTS type selection components.

ALTER TABLE public.ielts_assignment_types
  ADD COLUMN theme_color_from TEXT,
  ADD COLUMN theme_color_to TEXT,
  ADD COLUMN theme_border_color TEXT;

-- Backfill existing rows so active configs immediately return usable metadata.
UPDATE public.ielts_assignment_types
SET
  theme_color_from = '#EFF6FF',
  theme_color_to = '#DBEAFE',
  theme_border_color = '#BFDBFE'
WHERE id = 'reading'
  AND (theme_color_from IS NULL OR theme_color_to IS NULL OR theme_border_color IS NULL);

UPDATE public.ielts_assignment_types
SET
  theme_color_from = '#FAF5FF',
  theme_color_to = '#F3E8FF',
  theme_border_color = '#E9D5FF'
WHERE id = 'listening'
  AND (theme_color_from IS NULL OR theme_color_to IS NULL OR theme_border_color IS NULL);

UPDATE public.ielts_assignment_types
SET
  theme_color_from = '#F0FDF4',
  theme_color_to = '#DCFCE7',
  theme_border_color = '#BBF7D0'
WHERE id = 'writing'
  AND (theme_color_from IS NULL OR theme_color_to IS NULL OR theme_border_color IS NULL);

UPDATE public.ielts_assignment_types
SET
  theme_color_from = '#FFF7ED',
  theme_color_to = '#FFEDD5',
  theme_border_color = '#FED7AA'
WHERE id = 'speaking'
  AND (theme_color_from IS NULL OR theme_color_to IS NULL OR theme_border_color IS NULL);
