-- File: backend/src/prisma/migrations/20260209143000_add_user_notification_preferences/migration.sql
-- Purpose: Persist per-user notification preference overrides for backend delivery checks.
-- Why: Allows teacher-level filtering to suppress delivery for disabled notification types.

CREATE TABLE IF NOT EXISTS public.user_notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_notification_prefs_user_type_key UNIQUE (user_id, type)
);

CREATE INDEX IF NOT EXISTS user_notification_prefs_user_type_enabled_idx
  ON public.user_notification_preferences(user_id, type, enabled);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_notification_preferences TO authenticated;
