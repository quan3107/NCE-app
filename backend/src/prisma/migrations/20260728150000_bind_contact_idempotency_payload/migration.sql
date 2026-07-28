-- File: backend/src/prisma/migrations/20260728150000_bind_contact_idempotency_payload/migration.sql
-- Purpose: Bind each contact idempotency key to one canonical user payload.
-- Why: A reused key must not silently acknowledge different content that was never stored.

BEGIN;

SET lock_timeout = '5s';
SET statement_timeout = '5min';

CREATE OR REPLACE FUNCTION app.submit_contact_message(
  p_idempotency_key UUID,
  p_name TEXT,
  p_email CITEXT,
  p_subject TEXT,
  p_message TEXT,
  p_source TEXT,
  p_metadata JSONB
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
BEGIN
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

  IF FOUND THEN
    RETURN;
  END IF;

  -- Request metadata can legitimately change between retries. Only canonical
  -- user fields define the payload identity associated with the key.
  IF EXISTS (
    SELECT 1
    FROM public.contact_submissions
    WHERE idempotency_key = p_idempotency_key
      AND name = p_name
      AND email = p_email
      AND subject = p_subject
      AND message = p_message
  ) THEN
    RETURN;
  END IF;

  RAISE EXCEPTION
    'Idempotency key is already bound to a different contact payload.'
    USING ERRCODE = '23505';
END;
$function$;

COMMIT;
