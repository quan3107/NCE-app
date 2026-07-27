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
  idempotency_key UUID NOT NULL UNIQUE,
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

-- Request roles receive no table access. A security-definer function owns the
-- narrow insert and returns no row, so INSERT ... RETURNING cannot require SELECT.
REVOKE ALL ON public.contact_submissions
  FROM anon, authenticated, nce_app_anon, nce_app_authenticated;

CREATE FUNCTION app.submit_contact_message(
  p_idempotency_key UUID,
  p_name TEXT,
  p_email CITEXT,
  p_subject TEXT,
  p_message TEXT,
  p_source TEXT,
  p_metadata JSONB
) RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
  INSERT INTO public.contact_submissions (
    idempotency_key,
    name,
    email,
    subject,
    message,
    source,
    status,
    metadata
  )
  VALUES (
    p_idempotency_key,
    p_name,
    p_email,
    p_subject,
    p_message,
    p_source,
    'new',
    p_metadata
  )
  ON CONFLICT (idempotency_key) DO NOTHING;
$function$;

REVOKE ALL ON FUNCTION app.submit_contact_message(
  UUID, TEXT, CITEXT, TEXT, TEXT, TEXT, JSONB
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION app.submit_contact_message(
  UUID, TEXT, CITEXT, TEXT, TEXT, TEXT, JSONB
) TO nce_app_anon, nce_app_authenticated;

-- Service operations can recover and triage submissions without exposing them
-- through anonymous or authenticated request and browser roles.
GRANT SELECT, UPDATE ON public.contact_submissions TO service_role;

COMMIT;
