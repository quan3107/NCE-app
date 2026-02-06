-- File: backend/src/prisma/migrations/20260204100116_convert_writing_prompts_to_html/migration.sql
-- Purpose: Convert existing IELTS writing plain text prompts to HTML format.
-- Why: Support rich text formatting in IELTS writing prompts by storing HTML instead of plain text.
-- Note: This migration backs up data first, then converts all writing task prompts to HTML.

-- Create backup table first
CREATE TABLE IF NOT EXISTS "assignments_backup_20260204" AS 
SELECT * FROM "assignments" WHERE "type" = 'writing';

-- Update Task 1 prompts: wrap in <p> tags and convert newlines to <br>
UPDATE "assignments"
SET "assignment_config" = jsonb_set(
  jsonb_set(
    "assignment_config",
    '{task1,prompt}',
    to_jsonb(
      '<p>' || 
      regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(
              COALESCE("assignment_config"->'task1'->>'prompt', ''),
              '&', '&amp;', 'g'
            ),
            '<', '&lt;', 'g'
          ),
          '>', '&gt;', 'g'
        ),
        E'\n', '<br>', 'g'
      ) || 
      '</p>'
    )
  ),
  '{task2,prompt}',
  to_jsonb(
    '<p>' || 
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            COALESCE("assignment_config"->'task2'->>'prompt', ''),
            '&', '&amp;', 'g'
          ),
          '<', '&lt;', 'g'
        ),
        '>', '&gt;', 'g'
      ),
      E'\n', '<br>', 'g'
    ) || 
    '</p>'
  )
)
WHERE "type" = 'writing'
  AND "assignment_config" IS NOT NULL
  AND (
    -- Only update if the prompt doesn't already look like HTML
    COALESCE("assignment_config"->'task1'->>'prompt', '') !~ '<[a-zA-Z][^>]*>'
    OR COALESCE("assignment_config"->'task2'->>'prompt', '') !~ '<[a-zA-Z][^>]*>'
  );

-- Clean up empty paragraph tags
UPDATE "assignments"
SET "assignment_config" = jsonb_set(
  jsonb_set(
    "assignment_config",
    '{task1,prompt}',
    CASE 
      WHEN COALESCE("assignment_config"->'task1'->>'prompt', '') = '<p></p>' 
      THEN '""'::jsonb
      ELSE to_jsonb("assignment_config"->'task1'->>'prompt')
    END
  ),
  '{task2,prompt}',
  CASE 
    WHEN COALESCE("assignment_config"->'task2'->>'prompt', '') = '<p></p>' 
    THEN '""'::jsonb
    ELSE to_jsonb("assignment_config"->'task2'->>'prompt')
  END
)
WHERE "type" = 'writing'
  AND "assignment_config" IS NOT NULL;

-- Add comment to document the migration
COMMENT ON TABLE "assignments_backup_20260204" IS 'Backup of writing assignments before HTML conversion - created 2026-02-04';
