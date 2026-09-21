-- Where: users. What: hashed, single-use recovery credentials. Why: no raw reset secrets at rest.
ALTER TABLE "users" ADD COLUMN "password_reset_hash" TEXT,
  ADD COLUMN "password_reset_expires_at" TIMESTAMPTZ;
CREATE UNIQUE INDEX "users_password_reset_hash_key" ON "users"("password_reset_hash");
