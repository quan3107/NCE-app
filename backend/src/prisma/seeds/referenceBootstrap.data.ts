/**
 * File: src/prisma/seeds/referenceBootstrap.data.ts
 * Purpose: Define required non-demo reference rows for production bootstrap.
 * Why: Stable keys let bootstrap create missing rows without overwriting managed values.
 */
import { UserRole } from '../generated.js'

// prettier-ignore
export const permissionDefaults = [
  ['dashboard:view', 'View Dashboard', [UserRole.student, UserRole.teacher, UserRole.admin]],
  ['assignments:read', 'Read Assignments', [UserRole.student, UserRole.teacher, UserRole.admin]],
  ['assignments:submit', 'Submit Assignments', [UserRole.student]],
  ['assignments:create', 'Create Assignments', [UserRole.teacher, UserRole.admin]],
  ['assignments:edit', 'Edit Assignments', [UserRole.teacher, UserRole.admin]],
  ['assignments:delete', 'Delete Assignments', [UserRole.teacher, UserRole.admin]],
  ['grades:view', 'View Grades', [UserRole.student, UserRole.teacher, UserRole.admin]],
  ['notifications:read', 'Read Notifications', [UserRole.student, UserRole.teacher, UserRole.admin]],
  ['profile:view', 'View Profile', [UserRole.student, UserRole.teacher, UserRole.admin]],
  ['profile:edit', 'Edit Profile', [UserRole.student, UserRole.teacher, UserRole.admin]],
  ['courses:read', 'Read Courses', [UserRole.student, UserRole.teacher, UserRole.admin]],
  ['courses:manage', 'Manage Courses', [UserRole.teacher, UserRole.admin]],
  ['submissions:read', 'Read Submissions', [UserRole.teacher, UserRole.admin]],
  ['submissions:grade', 'Grade Submissions', [UserRole.teacher, UserRole.admin]],
  ['rubrics:manage', 'Manage Rubrics', [UserRole.teacher, UserRole.admin]],
  ['analytics:view', 'View Analytics', [UserRole.teacher, UserRole.admin]],
  ['users:manage', 'Manage Users', [UserRole.admin]],
  ['enrollments:manage', 'Manage Enrollments', [UserRole.admin]],
  ['audit-logs:view', 'View Audit Logs', [UserRole.admin]],
  ['cms:manage', 'Manage CMS Content', [UserRole.admin]],
  ['settings:manage', 'Manage Settings', [UserRole.admin]],
] as const

// prettier-ignore
export const navigationDefaults = [
  [UserRole.student, 'Dashboard', '/student/dashboard', 'layout-dashboard', 'dashboard:view', null, 0],
  [UserRole.student, 'Assignments', '/student/assignments', 'file-text', 'assignments:read', 'assignments', 1],
  [UserRole.student, 'NCE Path', '/student/nce', 'book-open', 'courses:read', null, 2],
  [UserRole.student, 'Grades', '/student/grades', 'graduation-cap', 'grades:view', null, 3],
  [UserRole.student, 'Notifications', '/student/notifications', 'bell', 'notifications:read', 'notifications', 4],
  [UserRole.student, 'Profile', '/student/profile', 'user', 'profile:view', null, 5],
  [UserRole.teacher, 'Dashboard', '/teacher/dashboard', 'layout-dashboard', 'dashboard:view', null, 0],
  [UserRole.teacher, 'Courses', '/teacher/courses', 'book-open', 'courses:read', null, 1],
  [UserRole.teacher, 'Assignments', '/teacher/assignments', 'file-text', 'assignments:create', null, 2],
  [UserRole.teacher, 'Submissions', '/teacher/submissions', 'scroll-text', 'submissions:read', 'submissions', 3],
  [UserRole.teacher, 'Notifications', '/teacher/notifications', 'bell', 'notifications:read', 'notifications', 4],
  [UserRole.teacher, 'NCE Lessons', '/teacher/nce-lessons', 'book-open', 'courses:manage', null, 5],
  [UserRole.teacher, 'Rubrics', '/teacher/rubrics', 'book-marked', 'rubrics:manage', null, 6],
  [UserRole.teacher, 'Analytics', '/teacher/analytics', 'bar-chart-3', 'analytics:view', null, 7],
  [UserRole.teacher, 'Profile', '/teacher/profile', 'user', 'profile:view', null, 8],
  [UserRole.admin, 'Dashboard', '/admin/dashboard', 'layout-dashboard', 'dashboard:view', null, 0],
  [UserRole.admin, 'Users', '/admin/users', 'users', 'users:manage', null, 1],
  [UserRole.admin, 'Courses', '/admin/courses', 'book-open', 'courses:manage', null, 2],
  [UserRole.admin, 'Enrollments', '/admin/enrollments', 'graduation-cap', 'enrollments:manage', null, 3],
  [UserRole.admin, 'Audit Logs', '/admin/logs', 'scroll-text', 'audit-logs:view', null, 4],
  [UserRole.admin, 'Content', '/admin/content', 'file-pen-line', 'cms:manage', null, 5],
  [UserRole.admin, 'Settings', '/admin/settings', 'settings', 'settings:manage', null, 6],
] as const

// prettier-ignore
export const notificationDefaults = [
  [UserRole.student, 'assignment_published', 'Assignment Published', 'When a new assignment is published.', 'assignments', 1],
  [UserRole.student, 'due_soon', 'Due Soon', 'When an assignment deadline is approaching.', 'assignments', 2],
  [UserRole.student, 'graded', 'Graded', 'When feedback and scores are released.', 'grading', 3],
  [UserRole.student, 'reminder', 'Reminder', 'General reminders and nudges.', 'general', 4],
  [UserRole.student, 'weekly_digest', 'Weekly Digest', 'A weekly summary of upcoming coursework.', 'digest', 5],
  [UserRole.teacher, 'new_submission', 'New Submission', 'When a student submits new work.', 'grading', 1],
  [UserRole.teacher, 'reminder', 'Reminder', 'General reminders and workflow nudges.', 'general', 2],
  [UserRole.teacher, 'weekly_digest', 'Weekly Digest', 'A weekly summary of assignment activity.', 'digest', 3],
  [UserRole.admin, 'reminder', 'Reminder', 'General operational reminders.', 'general', 1],
  [UserRole.admin, 'weekly_digest', 'Weekly Digest', 'A weekly platform activity summary.', 'digest', 2],
  [UserRole.admin, 'schedule_update', 'Schedule Update', 'When class schedules or events are updated.', 'system', 3],
] as const

type WidgetTuple = readonly [
  UserRole,
  string,
  string,
  string,
  string,
  string,
  string,
  number,
]
// prettier-ignore
export const dashboardDefaults: readonly WidgetTuple[] = [
  [UserRole.student, 'student_due_soon', 'Due Soon', 'clock', 'text-orange-500', 'student.assignments_due_soon', 'number', 0],
  [UserRole.student, 'student_assigned', 'Assigned', 'file-text', 'text-blue-500', 'student.assignments_assigned', 'number', 1],
  [UserRole.student, 'student_completed', 'Completed', 'check-circle-2', 'text-green-500', 'student.assignments_completed', 'number', 2],
  [UserRole.student, 'student_late', 'Late', 'alert-circle', 'text-red-500', 'student.assignments_late', 'number', 3],
  [UserRole.teacher, 'teacher_active_assignments', 'Active Assignments', 'file-text', 'text-muted-foreground', 'teacher.assignments_active', 'number', 0],
  [UserRole.teacher, 'teacher_pending_grading', 'Pending Grading', 'clock', 'text-orange-500', 'teacher.submissions_pending_grading', 'number', 1],
  [UserRole.teacher, 'teacher_total_students', 'Total Students', 'users', 'text-blue-500', 'teacher.students_total', 'number', 2],
  [UserRole.teacher, 'teacher_on_time_rate', 'On-time Rate', 'gauge', 'text-blue-500', 'teacher.submissions_on_time_rate', 'percent', 3],
  [UserRole.teacher, 'teacher_avg_turnaround', 'Avg Turnaround', 'timer', 'text-green-500', 'teacher.grading_average_turnaround_days', 'days', 4],
  [UserRole.admin, 'admin_total_users', 'Total Users', 'users', 'text-muted-foreground', 'admin.users_total', 'number', 0],
  [UserRole.admin, 'admin_total_courses', 'Courses', 'book-open', 'text-muted-foreground', 'admin.courses_total', 'number', 1],
  [UserRole.admin, 'admin_total_enrollments', 'Enrollments', 'check-circle-2', 'text-muted-foreground', 'admin.enrollments_total', 'number', 2],
  [UserRole.admin, 'admin_total_assignments', 'Assignments', 'file-text', 'text-muted-foreground', 'admin.assignments_total', 'number', 3],
]

// prettier-ignore
export const uploadTypeDefaults = [
  ['application/pdf', ['.pdf'], 'PDF Document', '.pdf', 1],
  ['application/msword', ['.doc'], 'Word Document', '.doc', 2],
  ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', ['.docx'], 'Word Document', '.docx', 3],
  ['audio/*', ['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac', '.webm'], 'Audio Files', 'audio/*', 4],
  ['image/*', ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'], 'Image Files', 'image/*', 5],
] as const
