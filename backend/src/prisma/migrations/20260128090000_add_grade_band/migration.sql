-- File: backend/src/prisma/migrations/20260128090000_add_grade_band/migration.sql
-- Purpose: Add IELTS band storage to grades.
-- Why: Persists auto-scored reading/listening band results alongside raw/final scores.

ALTER TABLE "grades"
  ADD COLUMN "band" DECIMAL(3, 1);
