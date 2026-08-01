-- File: backend/src/prisma/migrations/20260801110000_quarantine_legacy_display_names/migration.sql
-- Purpose: Quarantine historical display names containing non-printing Unicode controls.
-- Why: Pre-validation identity text must not remain capable of visual spoofing after upgrade.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

WITH unsafe_users AS (
  SELECT users.id
  FROM public.users AS users
  WHERE char_length(users.full_name) NOT BETWEEN 2 AND 100
    OR users.full_name <> btrim(users.full_name)
    OR EXISTS (
      SELECT 1
      FROM generate_series(1, char_length(users.full_name)) AS positions(index)
      CROSS JOIN LATERAL (
        SELECT ascii(substring(users.full_name FROM positions.index FOR 1)) AS value
      ) AS code_point
      WHERE code_point.value BETWEEN 1 AND 31
        OR code_point.value BETWEEN 127 AND 159
        OR code_point.value = 173
        OR code_point.value BETWEEN 1536 AND 1541
        OR code_point.value IN (1564, 1757, 1807, 2274, 6158, 65279, 69821, 69837, 917505)
        OR code_point.value BETWEEN 2192 AND 2193
        OR code_point.value BETWEEN 8203 AND 8207
        OR code_point.value BETWEEN 8232 AND 8238
        OR code_point.value BETWEEN 8288 AND 8292
        OR code_point.value BETWEEN 8294 AND 8303
        OR code_point.value BETWEEN 65529 AND 65531
        OR code_point.value BETWEEN 78896 AND 78911
        OR code_point.value BETWEEN 113824 AND 113827
        OR code_point.value BETWEEN 119155 AND 119162
        OR code_point.value BETWEEN 917536 AND 917631
        OR (
          positions.index IN (1, char_length(users.full_name))
          AND (
            code_point.value IN (32, 160, 5760, 8239, 8287, 12288)
            OR code_point.value BETWEEN 8192 AND 8202
          )
        )
    )
)
UPDATE public.users AS users
SET
  full_name = 'User ' || LEFT(REPLACE(users.id::text, '-', ''), 12),
  "updatedAt" = NOW()
FROM unsafe_users
WHERE unsafe_users.id = users.id;

COMMIT;
