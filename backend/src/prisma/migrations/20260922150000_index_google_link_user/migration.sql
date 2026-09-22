-- File: Google linking account index migration.
-- Purpose: Cover the challenge's account foreign key and per-account cleanup.
-- Why: Preserve the schema-governance requirement for indexed foreign keys.
CREATE INDEX "google_link_challenges_user_id_idx" ON "google_link_challenges"("user_id");
