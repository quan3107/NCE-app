-- Add extended marketing content columns for course detail overviews.
ALTER TABLE "courses"
    ADD COLUMN "learning_outcomes" JSONB,
    ADD COLUMN "structure_summary" TEXT,
    ADD COLUMN "prerequisites_summary" TEXT;
