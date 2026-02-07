-- File: backend/src/prisma/migrations/20260206224500_add_dashboard_widget_config/migration.sql
-- Purpose: Add role-based dashboard widget defaults and user personalization preferences.
-- Why: Moves dashboard widget metadata from frontend constants to backend-managed configuration.

CREATE TABLE public.dashboard_widget_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role "UserRole" NOT NULL,
  widget_key TEXT NOT NULL,
  type TEXT NOT NULL,
  label TEXT NOT NULL,
  icon_name TEXT NOT NULL,
  color TEXT NOT NULL,
  data_source TEXT NOT NULL,
  value_format TEXT NOT NULL,
  default_order INTEGER NOT NULL DEFAULT 0,
  default_visible BOOLEAN NOT NULL DEFAULT TRUE,
  default_x INTEGER NOT NULL DEFAULT 0,
  default_y INTEGER NOT NULL DEFAULT 0,
  default_w INTEGER NOT NULL DEFAULT 1,
  default_h INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT dashboard_widget_defs_role_widget_key_key UNIQUE (role, widget_key)
);

CREATE INDEX dashboard_widget_defs_role_active_order_idx
  ON public.dashboard_widget_definitions(role, is_active, default_order);

CREATE TABLE public.user_dashboard_widget_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  widget_definition_id UUID NOT NULL REFERENCES public.dashboard_widget_definitions(id) ON DELETE CASCADE,
  visible BOOLEAN NOT NULL DEFAULT TRUE,
  order_index INTEGER NOT NULL,
  x INTEGER NOT NULL,
  y INTEGER NOT NULL,
  w INTEGER NOT NULL,
  h INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_dashboard_widget_prefs_user_widget_key UNIQUE (user_id, widget_definition_id)
);

CREATE INDEX user_dashboard_widget_prefs_user_order_idx
  ON public.user_dashboard_widget_preferences(user_id, order_index);

-- Baseline role defaults sourced from existing dashboard stat cards.
INSERT INTO public.dashboard_widget_definitions (
  role,
  widget_key,
  type,
  label,
  icon_name,
  color,
  data_source,
  value_format,
  default_order,
  default_visible,
  default_x,
  default_y,
  default_w,
  default_h,
  is_active
)
VALUES
  ('student'::"UserRole", 'student_due_soon', 'stat', 'Due Soon', 'clock', 'text-orange-500', 'student.assignments_due_soon', 'number', 0, TRUE, 0, 0, 1, 1, TRUE),
  ('student'::"UserRole", 'student_assigned', 'stat', 'Assigned', 'file-text', 'text-blue-500', 'student.assignments_assigned', 'number', 1, TRUE, 1, 0, 1, 1, TRUE),
  ('student'::"UserRole", 'student_completed', 'stat', 'Completed', 'check-circle-2', 'text-green-500', 'student.assignments_completed', 'number', 2, TRUE, 2, 0, 1, 1, TRUE),
  ('student'::"UserRole", 'student_late', 'stat', 'Late', 'alert-circle', 'text-red-500', 'student.assignments_late', 'number', 3, TRUE, 3, 0, 1, 1, TRUE),
  ('teacher'::"UserRole", 'teacher_active_assignments', 'stat', 'Active Assignments', 'file-text', 'text-muted-foreground', 'teacher.assignments_active', 'number', 0, TRUE, 0, 0, 1, 1, TRUE),
  ('teacher'::"UserRole", 'teacher_pending_grading', 'stat', 'Pending Grading', 'clock', 'text-orange-500', 'teacher.submissions_pending_grading', 'number', 1, TRUE, 1, 0, 1, 1, TRUE),
  ('teacher'::"UserRole", 'teacher_total_students', 'stat', 'Total Students', 'users', 'text-blue-500', 'teacher.students_total', 'number', 2, TRUE, 2, 0, 1, 1, TRUE),
  ('teacher'::"UserRole", 'teacher_on_time_rate', 'stat', 'On-time Rate', 'gauge', 'text-blue-500', 'teacher.submissions_on_time_rate', 'percent', 3, TRUE, 3, 0, 1, 1, TRUE),
  ('teacher'::"UserRole", 'teacher_avg_turnaround', 'stat', 'Avg Turnaround', 'timer', 'text-green-500', 'teacher.grading_average_turnaround_days', 'days', 4, TRUE, 4, 0, 1, 1, TRUE),
  ('admin'::"UserRole", 'admin_total_users', 'stat', 'Total Users', 'users', 'text-muted-foreground', 'admin.users_total', 'number', 0, TRUE, 0, 0, 1, 1, TRUE),
  ('admin'::"UserRole", 'admin_total_courses', 'stat', 'Courses', 'book-open', 'text-muted-foreground', 'admin.courses_total', 'number', 1, TRUE, 1, 0, 1, 1, TRUE),
  ('admin'::"UserRole", 'admin_total_enrollments', 'stat', 'Enrollments', 'check-circle-2', 'text-muted-foreground', 'admin.enrollments_total', 'number', 2, TRUE, 2, 0, 1, 1, TRUE),
  ('admin'::"UserRole", 'admin_total_assignments', 'stat', 'Assignments', 'file-text', 'text-muted-foreground', 'admin.assignments_total', 'number', 3, TRUE, 3, 0, 1, 1, TRUE)
ON CONFLICT (role, widget_key)
DO UPDATE SET
  type = EXCLUDED.type,
  label = EXCLUDED.label,
  icon_name = EXCLUDED.icon_name,
  color = EXCLUDED.color,
  data_source = EXCLUDED.data_source,
  value_format = EXCLUDED.value_format,
  default_order = EXCLUDED.default_order,
  default_visible = EXCLUDED.default_visible,
  default_x = EXCLUDED.default_x,
  default_y = EXCLUDED.default_y,
  default_w = EXCLUDED.default_w,
  default_h = EXCLUDED.default_h,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

GRANT SELECT ON public.dashboard_widget_definitions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_dashboard_widget_preferences TO authenticated;
