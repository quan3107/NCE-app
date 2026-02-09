-- File: backend/src/prisma/migrations/20260210150000_backfill_ielts_type_metadata_descriptions/migration.sql
-- Purpose: Align baseline IELTS type descriptions with section-10 card copy.
-- Why: Preserves prior frontend wording after moving metadata to backend config.

UPDATE public.ielts_assignment_types
SET description = 'Create a reading test with passages and questions'
WHERE id = 'reading'
  AND (description IS NULL OR description = '' OR description = 'Reading comprehension test');

UPDATE public.ielts_assignment_types
SET description = 'Build a listening test with audio sections'
WHERE id = 'listening'
  AND (description IS NULL OR description = '' OR description = 'Listening comprehension test');

UPDATE public.ielts_assignment_types
SET description = 'Design Task 1 and Task 2 writing prompts'
WHERE id = 'writing'
  AND (description IS NULL OR description = '' OR description = 'Writing test with Task 1 and Task 2');

UPDATE public.ielts_assignment_types
SET description = 'Set up speaking test with all three parts'
WHERE id = 'speaking'
  AND (description IS NULL OR description = '' OR description = 'Speaking test with three parts');
