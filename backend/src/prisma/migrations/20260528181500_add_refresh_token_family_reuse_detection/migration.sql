ALTER TABLE "auth_sessions"
  ADD COLUMN "family_id" uuid,
  ADD COLUMN "rotated_from_id" uuid,
  ADD COLUMN "replaced_at" timestamptz,
  ADD COLUMN "reuse_detected_at" timestamptz;

UPDATE "auth_sessions"
SET "family_id" = "id"
WHERE "family_id" IS NULL;

ALTER TABLE "auth_sessions"
  ALTER COLUMN "family_id" SET NOT NULL;

ALTER TABLE "auth_sessions"
  ADD CONSTRAINT "auth_sessions_rotated_from_id_fkey"
  FOREIGN KEY ("rotated_from_id") REFERENCES "auth_sessions"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "auth_sessions_family_id_revoked_at_idx"
  ON "auth_sessions"("family_id", "revoked_at");

CREATE INDEX "auth_sessions_rotated_from_id_idx"
  ON "auth_sessions"("rotated_from_id");
