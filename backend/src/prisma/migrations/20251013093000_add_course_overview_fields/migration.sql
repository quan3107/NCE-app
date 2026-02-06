-- Add extended marketing content columns for course detail overviews.
-- Idempotent guard: avoid failure if table/columns already exist.
ALTER TABLE IF EXISTS "courses"
    ADD COLUMN IF NOT EXISTS "learning_outcomes" JSONB,
    ADD COLUMN IF NOT EXISTS "structure_summary" TEXT,
    ADD COLUMN IF NOT EXISTS "prerequisites_summary" TEXT;
