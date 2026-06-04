CREATE TYPE "AiFeedbackDraftStatus" AS ENUM (
  'queued',
  'running',
  'accepted',
  'review_required',
  'rejected',
  'failed',
  'approved',
  'finalized',
  'superseded'
);

CREATE TYPE "AiFeedbackVisibilityMode" AS ENUM (
  'teacher_reviewed',
  'instant_student_visible',
  'hidden'
);

CREATE TYPE "AiFeedbackDraftDecision" AS ENUM (
  'accepted',
  'approved',
  'rejected',
  'finalized'
);

CREATE TYPE "AiFeedbackReasoningEffort" AS ENUM (
  'none',
  'low',
  'medium',
  'high',
  'xhigh'
);

CREATE TYPE "AiObjectiveExplanationStatus" AS ENUM (
  'completed',
  'failed'
);

CREATE TABLE "ai_feedback_drafts" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "submission_id" uuid NOT NULL,
  "assignment_id" uuid NOT NULL,
  "requester_user_id" uuid NOT NULL,
  "grade_id" uuid,
  "decision_actor_user_id" uuid,
  "prompt_version" text NOT NULL,
  "route_key" text NOT NULL,
  "provider" text NOT NULL,
  "model" text NOT NULL,
  "reasoning_effort" "AiFeedbackReasoningEffort",
  "input_hash" text NOT NULL,
  "status" "AiFeedbackDraftStatus" NOT NULL,
  "visibility_mode" "AiFeedbackVisibilityMode" NOT NULL,
  "generated_feedback_json" jsonb NOT NULL,
  "teacher_edited_feedback_json" jsonb,
  "normalized_criterion_suggestions" jsonb,
  "criteria_version" text,
  "safety_flags" jsonb,
  "decision" "AiFeedbackDraftDecision",
  "failure_code" text,
  "failure_message" text,
  "retry_count" integer NOT NULL DEFAULT 0,
  "next_retry_at" timestamptz,
  "last_attempt_at" timestamptz,
  "decided_at" timestamptz,
  "finalized_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz NOT NULL,
  "deleted_at" timestamptz,
  CONSTRAINT "ai_feedback_drafts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_objective_explanations" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "submission_id" uuid NOT NULL,
  "assignment_id" uuid NOT NULL,
  "requester_user_id" uuid NOT NULL,
  "question_id" text NOT NULL,
  "deterministic_result" text NOT NULL,
  "prompt_version" text NOT NULL,
  "source_context_hash" text NOT NULL,
  "route_key" text NOT NULL,
  "provider" text NOT NULL,
  "model" text NOT NULL,
  "status" "AiObjectiveExplanationStatus" NOT NULL,
  "generated_explanation_json" jsonb,
  "failure_code" text,
  "failure_message" text,
  "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz NOT NULL,
  "deleted_at" timestamptz,
  CONSTRAINT "ai_objective_explanations_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ai_feedback_drafts"
  ADD CONSTRAINT "ai_feedback_drafts_submission_id_fkey"
  FOREIGN KEY ("submission_id") REFERENCES "submissions"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_feedback_drafts"
  ADD CONSTRAINT "ai_feedback_drafts_assignment_id_fkey"
  FOREIGN KEY ("assignment_id") REFERENCES "assignments"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_feedback_drafts"
  ADD CONSTRAINT "ai_feedback_drafts_requester_user_id_fkey"
  FOREIGN KEY ("requester_user_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ai_feedback_drafts"
  ADD CONSTRAINT "ai_feedback_drafts_grade_id_fkey"
  FOREIGN KEY ("grade_id") REFERENCES "grades"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ai_feedback_drafts"
  ADD CONSTRAINT "ai_feedback_drafts_decision_actor_user_id_fkey"
  FOREIGN KEY ("decision_actor_user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ai_objective_explanations"
  ADD CONSTRAINT "ai_objective_explanations_submission_id_fkey"
  FOREIGN KEY ("submission_id") REFERENCES "submissions"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_objective_explanations"
  ADD CONSTRAINT "ai_objective_explanations_assignment_id_fkey"
  FOREIGN KEY ("assignment_id") REFERENCES "assignments"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_objective_explanations"
  ADD CONSTRAINT "ai_objective_explanations_requester_user_id_fkey"
  FOREIGN KEY ("requester_user_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "ai_feedback_drafts_submission_status_idx"
  ON "ai_feedback_drafts"("submission_id", "status");

CREATE INDEX "ai_feedback_drafts_assignment_status_idx"
  ON "ai_feedback_drafts"("assignment_id", "status");

CREATE INDEX "ai_feedback_drafts_requester_created_at_idx"
  ON "ai_feedback_drafts"("requester_user_id", "created_at");

CREATE INDEX "ai_feedback_drafts_grade_id_idx"
  ON "ai_feedback_drafts"("grade_id");

CREATE INDEX "ai_feedback_drafts_decision_actor_id_idx"
  ON "ai_feedback_drafts"("decision_actor_user_id");

CREATE UNIQUE INDEX "ai_feedback_drafts_one_active_generation_per_submission"
  ON "ai_feedback_drafts"("submission_id")
  WHERE "deleted_at" IS NULL AND "status" IN ('queued', 'running');

CREATE UNIQUE INDEX "ai_objective_explanations_cache_key"
  ON "ai_objective_explanations"(
    "submission_id",
    "assignment_id",
    "question_id",
    "deterministic_result",
    "prompt_version",
    "source_context_hash",
    "route_key",
    "requester_user_id"
  );

CREATE INDEX "ai_objective_explanations_submission_question_idx"
  ON "ai_objective_explanations"("submission_id", "question_id", "created_at");

CREATE INDEX "ai_objective_explanations_assignment_question_idx"
  ON "ai_objective_explanations"("assignment_id", "question_id", "created_at");

CREATE INDEX "ai_objective_explanations_requester_created_at_idx"
  ON "ai_objective_explanations"("requester_user_id", "created_at");
