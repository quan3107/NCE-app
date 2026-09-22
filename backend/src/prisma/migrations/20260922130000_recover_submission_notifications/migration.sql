-- Keep submission notification retries idempotent, including already-published legacy events.
ALTER TABLE public.notifications ADD COLUMN event_key TEXT;
CREATE UNIQUE INDEX notifications_event_key_key ON public.notifications(event_key);
WITH events AS (
  SELECT id, 'new_submission:' || (payload->>'submissionId') || ':' ||
    COALESCE(payload->>'submittedAt', 'initial') || ':' || user_id::text || ':' || channel::text AS key,
    row_number() OVER (PARTITION BY payload->>'submissionId', payload->>'submittedAt', user_id, channel
      ORDER BY (status = 'sent') DESC, "createdAt", id) AS position
  FROM public.notifications
  WHERE type = 'new_submission' AND payload->>'submissionId' IS NOT NULL
)
UPDATE public.notifications AS n SET event_key = events.key
FROM events WHERE n.id = events.id AND events.position = 1;
