-- File: backend/src/prisma/migrations/20260617133000_add_graded_submission_status/migration.sql
-- Purpose: Add the graded submission status to clean database resets.
-- Why: The Prisma schema and demo seed use SubmissionStatus.graded, so migration history must create the enum value.

ALTER TYPE "SubmissionStatus" ADD VALUE IF NOT EXISTS 'graded';
