-- File: backend/src/prisma/migrations/20260714153000_reconcile_application_schema/migration.sql
-- Purpose: Reconcile confirmed hosted nullability and index drift with the Prisma contract.
-- Why: Forward-only changes preserve data while making clean replay and hosted structure converge.

BEGIN;

SET lock_timeout = '5s';
SET statement_timeout = '15min';

-- Validated checks let PostgreSQL reuse the proof when applying NOT NULL.
ALTER TABLE public.cms_content_items
  ADD CONSTRAINT cms_content_items_required_fields_check
  CHECK (
    sort_order IS NOT NULL AND is_active IS NOT NULL AND
    created_at IS NOT NULL AND updated_at IS NOT NULL
  ) NOT VALID;
ALTER TABLE public.cms_content_items
  VALIDATE CONSTRAINT cms_content_items_required_fields_check;
ALTER TABLE public.cms_content_items
  ALTER COLUMN sort_order SET NOT NULL,
  ALTER COLUMN is_active SET NOT NULL,
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN updated_at SET NOT NULL;
ALTER TABLE public.cms_content_items
  DROP CONSTRAINT cms_content_items_required_fields_check;

ALTER TABLE public.cms_page_contents
  ADD CONSTRAINT cms_page_contents_required_fields_check
  CHECK (
    is_active IS NOT NULL AND created_at IS NOT NULL AND updated_at IS NOT NULL
  ) NOT VALID;
ALTER TABLE public.cms_page_contents
  VALIDATE CONSTRAINT cms_page_contents_required_fields_check;
ALTER TABLE public.cms_page_contents
  ALTER COLUMN is_active SET NOT NULL,
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN updated_at SET NOT NULL;
ALTER TABLE public.cms_page_contents
  DROP CONSTRAINT cms_page_contents_required_fields_check;

ALTER TABLE public.cms_sections
  ADD CONSTRAINT cms_sections_required_fields_check
  CHECK (
    sort_order IS NOT NULL AND created_at IS NOT NULL AND updated_at IS NOT NULL
  ) NOT VALID;
ALTER TABLE public.cms_sections
  VALIDATE CONSTRAINT cms_sections_required_fields_check;
ALTER TABLE public.cms_sections
  ALTER COLUMN sort_order SET NOT NULL,
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN updated_at SET NOT NULL;
ALTER TABLE public.cms_sections
  DROP CONSTRAINT cms_sections_required_fields_check;

ALTER TABLE public.ielts_config_versions
  ADD CONSTRAINT ielts_config_versions_required_fields_check
  CHECK (is_active IS NOT NULL AND created_at IS NOT NULL) NOT VALID;
ALTER TABLE public.ielts_config_versions
  VALIDATE CONSTRAINT ielts_config_versions_required_fields_check;
ALTER TABLE public.ielts_config_versions
  ALTER COLUMN is_active SET NOT NULL,
  ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE public.ielts_config_versions
  DROP CONSTRAINT ielts_config_versions_required_fields_check;

ALTER TABLE public.ielts_assignment_types
  ADD CONSTRAINT ielts_assignment_types_required_fields_check
  CHECK (
    enabled IS NOT NULL AND sort_order IS NOT NULL AND created_at IS NOT NULL
  ) NOT VALID;
ALTER TABLE public.ielts_assignment_types
  VALIDATE CONSTRAINT ielts_assignment_types_required_fields_check;
ALTER TABLE public.ielts_assignment_types
  ALTER COLUMN enabled SET NOT NULL,
  ALTER COLUMN sort_order SET NOT NULL,
  ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE public.ielts_assignment_types
  DROP CONSTRAINT ielts_assignment_types_required_fields_check;

ALTER TABLE public.ielts_completion_formats
  ADD CONSTRAINT ielts_completion_formats_required_fields_check
  CHECK (
    enabled IS NOT NULL AND sort_order IS NOT NULL AND created_at IS NOT NULL
  ) NOT VALID;
ALTER TABLE public.ielts_completion_formats
  VALIDATE CONSTRAINT ielts_completion_formats_required_fields_check;
ALTER TABLE public.ielts_completion_formats
  ALTER COLUMN enabled SET NOT NULL,
  ALTER COLUMN sort_order SET NOT NULL,
  ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE public.ielts_completion_formats
  DROP CONSTRAINT ielts_completion_formats_required_fields_check;

ALTER TABLE public.ielts_question_types
  ADD CONSTRAINT ielts_question_types_required_fields_check
  CHECK (
    enabled IS NOT NULL AND sort_order IS NOT NULL AND created_at IS NOT NULL
  ) NOT VALID;
ALTER TABLE public.ielts_question_types
  VALIDATE CONSTRAINT ielts_question_types_required_fields_check;
ALTER TABLE public.ielts_question_types
  ALTER COLUMN enabled SET NOT NULL,
  ALTER COLUMN sort_order SET NOT NULL,
  ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE public.ielts_question_types
  DROP CONSTRAINT ielts_question_types_required_fields_check;

ALTER TABLE public.ielts_sample_timing_options
  ADD CONSTRAINT ielts_sample_timing_options_required_fields_check
  CHECK (
    enabled IS NOT NULL AND sort_order IS NOT NULL AND created_at IS NOT NULL
  ) NOT VALID;
ALTER TABLE public.ielts_sample_timing_options
  VALIDATE CONSTRAINT ielts_sample_timing_options_required_fields_check;
ALTER TABLE public.ielts_sample_timing_options
  ALTER COLUMN enabled SET NOT NULL,
  ALTER COLUMN sort_order SET NOT NULL,
  ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE public.ielts_sample_timing_options
  DROP CONSTRAINT ielts_sample_timing_options_required_fields_check;

ALTER TABLE public.ielts_speaking_part_types
  ADD CONSTRAINT ielts_speaking_part_types_required_fields_check
  CHECK (
    enabled IS NOT NULL AND sort_order IS NOT NULL AND created_at IS NOT NULL
  ) NOT VALID;
ALTER TABLE public.ielts_speaking_part_types
  VALIDATE CONSTRAINT ielts_speaking_part_types_required_fields_check;
ALTER TABLE public.ielts_speaking_part_types
  ALTER COLUMN enabled SET NOT NULL,
  ALTER COLUMN sort_order SET NOT NULL,
  ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE public.ielts_speaking_part_types
  DROP CONSTRAINT ielts_speaking_part_types_required_fields_check;

ALTER TABLE public.ielts_writing_task_types
  ADD CONSTRAINT ielts_writing_task_types_required_fields_check
  CHECK (
    enabled IS NOT NULL AND sort_order IS NOT NULL AND created_at IS NOT NULL
  ) NOT VALID;
ALTER TABLE public.ielts_writing_task_types
  VALIDATE CONSTRAINT ielts_writing_task_types_required_fields_check;
ALTER TABLE public.ielts_writing_task_types
  ALTER COLUMN enabled SET NOT NULL,
  ALTER COLUMN sort_order SET NOT NULL,
  ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE public.ielts_writing_task_types
  DROP CONSTRAINT ielts_writing_task_types_required_fields_check;

-- Restore application query indexes already declared by schema.prisma.
CREATE INDEX "assignments_course_id_deletedAt_createdAt_idx"
  ON public.assignments(course_id, "deletedAt", "createdAt");
CREATE INDEX "assignments_deletedAt_due_at_idx"
  ON public.assignments("deletedAt", due_at);
CREATE INDEX "audit_logs_deletedAt_createdAt_id_idx"
  ON public.audit_logs("deletedAt", "createdAt", id);
CREATE INDEX "auth_sessions_refresh_token_hash_revoked_at_idx"
  ON public.auth_sessions(refresh_token_hash, revoked_at);
CREATE INDEX "cms_content_items_section_id_sort_order_is_active_idx"
  ON public.cms_content_items(section_id, sort_order, is_active);
CREATE INDEX "courses_deletedAt_createdAt_idx"
  ON public.courses("deletedAt", "createdAt");
CREATE INDEX "enrollments_user_id_role_in_course_deletedAt_idx"
  ON public.enrollments(user_id, role_in_course, "deletedAt");
CREATE INDEX "enrollments_course_id_role_in_course_deletedAt_createdAt_idx"
  ON public.enrollments(course_id, role_in_course, "deletedAt", "createdAt");
CREATE INDEX "notifications_user_id_deletedAt_createdAt_idx"
  ON public.notifications(user_id, "deletedAt", "createdAt");
CREATE INDEX "notifications_status_deletedAt_createdAt_idx"
  ON public.notifications(status, "deletedAt", "createdAt");
CREATE INDEX "notifications_user_id_read_at_deletedAt_idx"
  ON public.notifications(user_id, read_at, "deletedAt");
CREATE INDEX "rubrics_course_id_deletedAt_createdAt_idx"
  ON public.rubrics(course_id, "deletedAt", "createdAt");
CREATE INDEX "submissions_assignment_id_deletedAt_createdAt_idx"
  ON public.submissions(assignment_id, "deletedAt", "createdAt");
CREATE INDEX "submissions_assignment_id_status_deletedAt_idx"
  ON public.submissions(assignment_id, status, "deletedAt");
CREATE INDEX "users_deletedAt_createdAt_idx"
  ON public.users("deletedAt", "createdAt");

-- Cover the ten foreign keys that lacked a complete leading index.
CREATE INDEX "ielts_assignment_types_config_version_idx"
  ON public.ielts_assignment_types(config_version);
CREATE INDEX "ielts_completion_formats_config_version_idx"
  ON public.ielts_completion_formats(config_version);
CREATE INDEX "ielts_question_types_config_version_idx"
  ON public.ielts_question_types(config_version);
CREATE INDEX "ielts_sample_timing_options_config_version_idx"
  ON public.ielts_sample_timing_options(config_version);
CREATE INDEX "ielts_speaking_part_types_config_version_idx"
  ON public.ielts_speaking_part_types(config_version);
CREATE INDEX "ielts_writing_task_types_config_version_idx"
  ON public.ielts_writing_task_types(config_version);
CREATE INDEX "nce_exercise_attempts_student_id_idx"
  ON public.nce_exercise_attempts(student_id);
CREATE INDEX "nce_lesson_progress_lesson_id_idx"
  ON public.nce_lesson_progress(lesson_id);
CREATE INDEX "user_dashboard_widget_preferences_widget_definition_id_idx"
  ON public.user_dashboard_widget_preferences(widget_definition_id);

-- Replace three strict-prefix indexes only after their wider replacements exist.
DROP INDEX IF EXISTS public.enrollments_user_id_role_in_course_idx;
DROP INDEX IF EXISTS public.idx_feature_flag_roles_feature_flag_id;
DROP INDEX IF EXISTS public.idx_role_permissions_role;

COMMIT;
