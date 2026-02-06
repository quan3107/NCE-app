-- File: backend/src/prisma/migrations/20260127103000_add_assignment_config_and_ielts_types/migration.sql
-- Purpose: Add IELTS assignment types and store per-assignment config payloads.
-- Why: Supports IELTS-specific structures while keeping config optional for non-IELTS types.
-- Note: Idempotent guards avoid failures when columns/values already exist.

ALTER TYPE "AssignmentType" ADD VALUE IF NOT EXISTS 'reading';
ALTER TYPE "AssignmentType" ADD VALUE IF NOT EXISTS 'listening';
ALTER TYPE "AssignmentType" ADD VALUE IF NOT EXISTS 'writing';
ALTER TYPE "AssignmentType" ADD VALUE IF NOT EXISTS 'speaking';

ALTER TABLE "assignments"
  ADD COLUMN IF NOT EXISTS "assignment_config" JSONB;
