-- Purpose: Preserve replacement history and enforce durable reminder deduplication.
-- Why: Existing backend-only tables retain their access policies and grants.
ALTER TABLE public.enrollments ADD COLUMN reminders_muted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.submissions ADD COLUMN revision_history JSONB NOT NULL DEFAULT '[]';
ALTER TABLE public.notifications ADD COLUMN reminder_key TEXT;
CREATE UNIQUE INDEX notifications_reminder_key_key ON public.notifications(reminder_key);

-- Keep a tombstone for old occurrences, including deleted/suppressed notifications.
WITH occurrences AS (
  SELECT id, (payload->>'assignmentId') || ':' || (payload->>'dueAt') || ':' || user_id::text || ':' || channel::text AS key,
    row_number() OVER (PARTITION BY payload->>'assignmentId', payload->>'dueAt', user_id, channel
      ORDER BY (status = 'sent') DESC, "createdAt", id) AS position
  FROM public.notifications
  WHERE type = 'due_soon' AND payload->>'assignmentId' IS NOT NULL AND payload->>'dueAt' IS NOT NULL
)
UPDATE public.notifications AS n SET reminder_key = occurrences.key
FROM occurrences WHERE n.id = occurrences.id AND occurrences.position = 1;
UPDATE public.notifications SET status = 'suppressed', failure_reason = 'legacy_duplicate_reminder'
WHERE type = 'due_soon' AND reminder_key IS NULL AND status IN ('queued', 'failed', 'dead_letter');

-- Historical jobs must not deliver digests after the product decision changes.
UPDATE public.notifications SET status = 'suppressed', failure_reason = 'weekly_digest_disabled'
WHERE type = 'weekly_digest' AND status IN ('queued', 'failed', 'dead_letter');
