-- File: backend/src/prisma/migrations/20260709110000_add_cleanup_retention_indexes/migration.sql
-- Purpose: Add indexes for bounded cleanup retention batch selection.
-- Why: Daily cleanup must find stale auth sessions and notification metadata without broad scans.

CREATE INDEX IF NOT EXISTS "auth_sessions_deletedAt_expiresAt_id_idx"
  ON public.auth_sessions("deletedAt", expires_at, id);

CREATE INDEX IF NOT EXISTS "auth_sessions_deletedAt_revokedAt_id_idx"
  ON public.auth_sessions("deletedAt", revoked_at, id);

CREATE INDEX IF NOT EXISTS "auth_sessions_deletedAt_replacedAt_id_idx"
  ON public.auth_sessions("deletedAt", replaced_at, id);

CREATE INDEX IF NOT EXISTS "auth_sessions_deletedAt_reuseDetectedAt_id_idx"
  ON public.auth_sessions("deletedAt", reuse_detected_at, id);

CREATE INDEX IF NOT EXISTS "notifications_status_deletedAt_deadLetteredAt_id_idx"
  ON public.notifications(status, "deletedAt", dead_lettered_at, id);

CREATE INDEX IF NOT EXISTS "notifications_status_deletedAt_updatedAt_id_idx"
  ON public.notifications(status, "deletedAt", "updatedAt", id);
