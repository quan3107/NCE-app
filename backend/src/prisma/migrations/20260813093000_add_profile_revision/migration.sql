-- File: src/prisma/migrations/20260813093000_add_profile_revision/migration.sql
-- Purpose: Add optimistic concurrency ordering to authenticated profiles.
-- Why: Profile responses can arrive out of order across tabs and must remain comparable.

ALTER TABLE public.users
  ADD COLUMN profile_revision INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.users
  ADD CONSTRAINT users_profile_revision_nonnegative
  CHECK (profile_revision >= 0);
