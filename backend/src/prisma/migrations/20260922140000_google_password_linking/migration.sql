-- File: Google password linking migration (generated scaffold adapted to Prisma's forward ledger).
-- Purpose: Persist expiring browser-bound linking proofs outside public user data.
-- Why: Only the backend service role may inspect, issue, or consume these proofs.
CREATE TABLE "google_link_challenges" (
  "id" UUID NOT NULL,
  "token_hash" TEXT NOT NULL,
  "user_id" UUID NOT NULL,
  "subject" TEXT NOT NULL,
  "issuer" TEXT NOT NULL,
  "email" CITEXT NOT NULL,
  "password_fingerprint" TEXT NOT NULL,
  "expires_at" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "google_link_challenges_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "google_link_challenges_token_hash_key" ON "google_link_challenges"("token_hash");
CREATE INDEX "google_link_challenges_expires_at_idx" ON "google_link_challenges"("expires_at");
ALTER TABLE "google_link_challenges" ADD CONSTRAINT "google_link_challenges_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE public.google_link_challenges ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.google_link_challenges FROM PUBLIC, anon, authenticated, nce_app_anon, nce_app_authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.google_link_challenges TO service_role;
CREATE POLICY google_link_challenges_service ON public.google_link_challenges
  FOR ALL TO service_role USING (true) WITH CHECK (true);
