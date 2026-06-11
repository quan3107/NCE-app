-- File: backend/src/prisma/migrations/20260611093000_grant_ai_feedback_table_access/migration.sql
-- Purpose: Grant runtime role access to AI feedback persistence tables.
-- Why: Request-scoped DB role switching requires table grants before service guards can read or update AI feedback records.

GRANT SELECT, INSERT, UPDATE ON
  public.ai_feedback_drafts,
  public.ai_objective_explanations
TO authenticated;
