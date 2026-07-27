-- File: backend/src/prisma/migrations/20260727190000_add_contact_submissions/migration.sql
-- Purpose: Persist public contact submissions behind the backend request roles.
-- Why: Messages must remain recoverable while direct browser Data API access stays denied.

BEGIN;

SET lock_timeout = '5s';
SET statement_timeout = '15min';

CREATE TYPE public."ContactSubmissionStatus" AS ENUM (
  'new',
  'in_progress',
  'resolved',
  'spam'
);

CREATE TABLE public.contact_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email CITEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  source TEXT NOT NULL,
  status public."ContactSubmissionStatus" NOT NULL DEFAULT 'new',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX contact_submissions_status_created_at_idx
  ON public.contact_submissions(status, created_at);
CREATE INDEX contact_submissions_email_created_at_idx
  ON public.contact_submissions(email, created_at);

ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;

-- Only backend request roles can create public messages. Browser Data API roles
-- receive no table grant, and the initial status cannot be forged by callers.
GRANT INSERT ON public.contact_submissions
  TO nce_app_anon, nce_app_authenticated;
CREATE POLICY contact_submissions_backend_insert
  ON public.contact_submissions
  FOR INSERT
  TO nce_app_anon, nce_app_authenticated
  WITH CHECK (status = 'new');

-- Service operations can recover and triage submissions without exposing them
-- through the anonymous or authenticated browser roles.
GRANT SELECT, UPDATE ON public.contact_submissions TO service_role;

COMMIT;
