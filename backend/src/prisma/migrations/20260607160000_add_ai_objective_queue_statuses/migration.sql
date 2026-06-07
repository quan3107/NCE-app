ALTER TYPE "AiObjectiveExplanationStatus" ADD VALUE IF NOT EXISTS 'queued';
ALTER TYPE "AiObjectiveExplanationStatus" ADD VALUE IF NOT EXISTS 'running';
ALTER TYPE "AiObjectiveExplanationStatus" ADD VALUE IF NOT EXISTS 'review_required';
ALTER TYPE "AiObjectiveExplanationStatus" ADD VALUE IF NOT EXISTS 'rejected';

ALTER TABLE "ai_objective_explanations"
  ADD COLUMN "retry_count" integer NOT NULL DEFAULT 0,
  ADD COLUMN "next_retry_at" timestamptz,
  ADD COLUMN "last_attempt_at" timestamptz;
