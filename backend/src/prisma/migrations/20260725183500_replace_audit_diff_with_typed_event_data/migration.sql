-- File: backend/src/prisma/migrations/20260725183500_replace_audit_diff_with_typed_event_data/migration.sql
-- Purpose: Replace open-ended audit diffs with required versioned event data.
-- Why: Preproduction audit history may contain private or uncontracted payloads and is unsafe to transform.

BEGIN;

SET lock_timeout = '5s';
SET statement_timeout = '15min';

-- Intentional preproduction data loss: incompatible legacy payloads are not
-- copied, classified, hashed, or otherwise retained.
DELETE FROM public.audit_logs;

ALTER TABLE public.audit_logs
  DROP COLUMN diff,
  ADD COLUMN event_data JSONB NOT NULL,
  ADD COLUMN schema_version INTEGER NOT NULL;

COMMIT;
