-- File: backend/src/prisma/migrations/20260630103000_add_notification_retry_recovery/migration.sql
-- Purpose: Add retry and dead-letter metadata for notification delivery.
-- Why: Makes failed notification delivery recoverable and inspectable by admins.

ALTER TYPE "NotificationStatus" ADD VALUE IF NOT EXISTS 'suppressed';
ALTER TYPE "NotificationStatus" ADD VALUE IF NOT EXISTS 'dead_letter';
ALTER TYPE "NotificationStatus" ADD VALUE IF NOT EXISTS 'sending';

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_attempts INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS failure_reason TEXT,
  ADD COLUMN IF NOT EXISTS dead_lettered_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS notifications_status_deletedAt_nextAttemptAt_idx
  ON public.notifications(status, "deletedAt", next_attempt_at);
