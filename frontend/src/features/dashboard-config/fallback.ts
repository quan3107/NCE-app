/**
 * Location: src/features/dashboard-config/fallback.ts
 * Purpose: Provide local role-based fallback dashboard widget configuration.
 * Why: Preserves dashboard usability when dashboard-config endpoints are unavailable.
 */

import type {
  DashboardRole,
  DashboardWidget,
  DashboardWidgetDefaultsResponse,
  MyDashboardConfigResponse,
} from './types';

const FALLBACK_VERSION = 'fallback-2026-02-06-001';

const widget = (
  id: string,
  label: string,
  iconName: string,
  color: string,
  dataSource: string,
  order: number,
  valueFormat: string = 'number',
): DashboardWidget => ({
  id,
  type: 'stat',
  label,
  icon_name: iconName,
  color,
  data_source: dataSource,
  value_format: valueFormat,
  visible: true,
  order,
  position: { x: order, y: 0, w: 1, h: 1 },
});

const fallbackByRole: Record<DashboardRole, DashboardWidget[]> = {
  student: [
    widget('student_due_soon', 'Due Soon', 'clock', 'text-orange-500', 'student.assignments_due_soon', 0),
    widget('student_assigned', 'Assigned', 'file-text', 'text-blue-500', 'student.assignments_assigned', 1),
    widget('student_completed', 'Completed', 'check-circle-2', 'text-green-500', 'student.assignments_completed', 2),
    widget('student_late', 'Late', 'alert-circle', 'text-red-500', 'student.assignments_late', 3),
  ],
  teacher: [
    widget('teacher_active_assignments', 'Active Assignments', 'file-text', 'text-muted-foreground', 'teacher.assignments_active', 0),
    widget('teacher_pending_grading', 'Pending Grading', 'clock', 'text-orange-500', 'teacher.submissions_pending_grading', 1),
    widget('teacher_total_students', 'Total Students', 'users', 'text-blue-500', 'teacher.students_total', 2),
    widget('teacher_on_time_rate', 'On-time Rate', 'gauge', 'text-blue-500', 'teacher.submissions_on_time_rate', 3, 'percent'),
    widget('teacher_avg_turnaround', 'Avg Turnaround', 'timer', 'text-green-500', 'teacher.grading_average_turnaround_days', 4, 'days'),
  ],
  admin: [
    widget('admin_total_users', 'Total Users', 'users', 'text-muted-foreground', 'admin.users_total', 0),
    widget('admin_total_courses', 'Courses', 'book-open', 'text-muted-foreground', 'admin.courses_total', 1),
    widget('admin_total_enrollments', 'Enrollments', 'check-circle-2', 'text-muted-foreground', 'admin.enrollments_total', 2),
    widget('admin_total_assignments', 'Assignments', 'file-text', 'text-muted-foreground', 'admin.assignments_total', 3),
  ],
};

export function getFallbackDashboardConfig(role: DashboardRole): MyDashboardConfigResponse {
  return {
    role,
    version: FALLBACK_VERSION,
    personalized: false,
    widgets: fallbackByRole[role],
  };
}

export function getFallbackDashboardWidgetDefaults(
  role: DashboardRole,
): DashboardWidgetDefaultsResponse {
  return {
    role,
    version: FALLBACK_VERSION,
    widgets: fallbackByRole[role].map((item) => ({
      id: item.id,
      type: item.type,
      label: item.label,
      icon_name: item.icon_name,
      color: item.color,
      data_source: item.data_source,
      value_format: item.value_format,
      default_order: item.order,
      default_visible: item.visible,
      position: item.position,
    })),
  };
}
