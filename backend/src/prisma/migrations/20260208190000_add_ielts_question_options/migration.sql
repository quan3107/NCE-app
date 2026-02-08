-- File: backend/src/prisma/migrations/20260208190000_add_ielts_question_options/migration.sql
-- Purpose: Add versioned IELTS question option values for boolean-style question types.
-- Why: Replaces hardcoded frontend option arrays with backend-driven configuration.

CREATE TABLE IF NOT EXISTS ielts_question_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_version INTEGER NOT NULL REFERENCES ielts_config_versions(version) ON DELETE CASCADE,
  option_type TEXT NOT NULL CHECK (option_type IN ('true_false', 'yes_no')),
  value TEXT NOT NULL,
  label TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ielts_question_opts_cfg_type_value_key UNIQUE (config_version, option_type, value)
);

CREATE INDEX IF NOT EXISTS ielts_question_opts_lookup_idx
  ON ielts_question_options (config_version, option_type, enabled, sort_order);

-- Seed canonical option values for the initial config version.
INSERT INTO ielts_question_options (config_version, option_type, value, label, score, sort_order)
VALUES
  (1, 'true_false', 'true', 'True', 1, 1),
  (1, 'true_false', 'false', 'False', 0, 2),
  (1, 'true_false', 'not_given', 'Not Given', 0, 3),
  (1, 'yes_no', 'yes', 'Yes', 1, 1),
  (1, 'yes_no', 'no', 'No', 0, 2),
  (1, 'yes_no', 'not_given', 'Not Given', 0, 3)
ON CONFLICT (config_version, option_type, value) DO NOTHING;

-- Public IELTS config endpoints run without auth (anon role).
GRANT SELECT ON public.ielts_question_options TO anon, authenticated;
