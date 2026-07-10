/**
 * Location: src/routes/lazyRouteComponents.ts
 * Purpose: Define lazy-loaded page components used by the application route tree.
 * Why: Keeps route bundle boundaries centralized without bloating AppRoutes.tsx.
 */
import { lazy } from 'react';

export const AdminAuditLogsPage = lazy(() =>
  import('@features/admin/components/AdminAuditLogsPage').then((module) => ({ default: module.AdminAuditLogsPage })),
);
export const AdminCmsPage = lazy(() =>
  import('@features/admin/components/AdminCmsPage').then((module) => ({ default: module.AdminCmsPage })),
);
export const AdminCoursesPage = lazy(() =>
  import('@features/admin/components/AdminCoursesPage').then((module) => ({ default: module.AdminCoursesPage })),
);
export const AdminDashboardPage = lazy(() =>
  import('@features/admin/components/AdminDashboardPage').then((module) => ({ default: module.AdminDashboardPage })),
);
export const AdminEnrollmentsPage = lazy(() =>
  import('@features/admin/components/AdminEnrollmentsPage').then((module) => ({ default: module.AdminEnrollmentsPage })),
);
export const AdminSettingsPage = lazy(() =>
  import('@features/admin/components/AdminSettingsPage').then((module) => ({ default: module.AdminSettingsPage })),
);
export const AdminUsersPage = lazy(() =>
  import('@features/admin/components/AdminUsersPage').then((module) => ({ default: module.AdminUsersPage })),
);
export const TeacherAnalyticsPage = lazy(() =>
  import('@features/analytics/components/TeacherAnalyticsPage').then((module) => ({ default: module.TeacherAnalyticsPage })),
);
export const StudentAssignmentDetailPage = lazy(() =>
  import('@features/assignments/components/StudentAssignmentDetailPage').then((module) => ({
    default: module.StudentAssignmentDetailPage,
  })),
);
export const StudentAssignmentsPage = lazy(() =>
  import('@features/assignments/components/StudentAssignmentsPage').then((module) => ({ default: module.StudentAssignmentsPage })),
);
export const TeacherAssignmentDetailPage = lazy(() =>
  import('@features/assignments/components/TeacherAssignmentDetailPage').then((module) => ({
    default: module.TeacherAssignmentDetailPage,
  })),
);
export const TeacherAssignmentEditPage = lazy(() =>
  import('@features/assignments/components/TeacherAssignmentEditPage').then((module) => ({
    default: module.TeacherAssignmentEditPage,
  })),
);
export const TeacherAssignmentsPage = lazy(() =>
  import('@features/assignments/components/TeacherAssignmentsPage').then((module) => ({ default: module.TeacherAssignmentsPage })),
);
export const TeacherIeltsAssignmentCreatePage = lazy(() =>
  import('@features/assignments/components/TeacherIeltsAssignmentCreatePage').then((module) => ({
    default: module.TeacherIeltsAssignmentCreatePage,
  })),
);
export const TeacherGradeFormPage = lazy(() =>
  import('@features/assignments/components/TeacherGradeFormPage').then((module) => ({ default: module.TeacherGradeFormPage })),
);
export const TeacherSubmissionsPage = lazy(() =>
  import('@features/assignments/components/TeacherSubmissionsPage').then((module) => ({ default: module.TeacherSubmissionsPage })),
);
export const TeacherCoursesPage = lazy(() =>
  import('@features/courses/components/TeacherCoursesPage').then((module) => ({ default: module.TeacherCoursesPage })),
);
export const TeacherCourseManagement = lazy(() =>
  import('@features/courses/management/TeacherCourseManagement').then((module) => ({ default: module.TeacherCourseManagement })),
);
export const TeacherNceLessonEditorPage = lazy(() =>
  import('@features/nce-content/components/TeacherNceLessonEditorPage').then((module) => ({
    default: module.TeacherNceLessonEditorPage,
  })),
);
export const TeacherNceLessonsPage = lazy(() =>
  import('@features/nce-content/components/TeacherNceLessonsPage').then((module) => ({ default: module.TeacherNceLessonsPage })),
);
export const StudentNceLessonPage = lazy(() =>
  import('@features/nce-learning/components/StudentNceLessonPage').then((module) => ({ default: module.StudentNceLessonPage })),
);
export const StudentNcePathPage = lazy(() =>
  import('@features/nce-learning/components/StudentNcePathPage').then((module) => ({ default: module.StudentNcePathPage })),
);
export const StudentGradesPage = lazy(() =>
  import('@features/grades/components/StudentGradesPage').then((module) => ({ default: module.StudentGradesPage })),
);
export const StudentNotificationsPage = lazy(() =>
  import('@features/notifications/components/StudentNotificationsPage').then((module) => ({
    default: module.StudentNotificationsPage,
  })),
);
export const StudentProfilePage = lazy(() =>
  import('@features/profile/components/StudentProfilePage').then((module) => ({ default: module.StudentProfilePage })),
);
export const TeacherProfilePage = lazy(() =>
  import('@features/profile/components/TeacherProfilePage').then((module) => ({ default: module.TeacherProfilePage })),
);
export const TeacherRubricsPage = lazy(() =>
  import('@features/rubrics/components/TeacherRubricsPage').then((module) => ({ default: module.TeacherRubricsPage })),
);
export const AboutRoute = lazy(() =>
  import('@routes/About').then((module) => ({ default: module.AboutRoute })),
);
export const ContactRoute = lazy(() =>
  import('@routes/Contact').then((module) => ({ default: module.ContactRoute })),
);
export const CourseDetailRoute = lazy(() =>
  import('@routes/CourseDetail').then((module) => ({ default: module.CourseDetailRoute })),
);
export const CoursesRoute = lazy(() =>
  import('@routes/Courses').then((module) => ({ default: module.CoursesRoute })),
);
export const DashboardStudentRoute = lazy(() =>
  import('@routes/DashboardStudent').then((module) => ({ default: module.DashboardStudentRoute })),
);
export const DashboardTeacherRoute = lazy(() =>
  import('@routes/DashboardTeacher').then((module) => ({ default: module.DashboardTeacherRoute })),
);
export const HomeRoute = lazy(() =>
  import('@routes/Home').then((module) => ({ default: module.HomeRoute })),
);
export const LoginRoute = lazy(() =>
  import('@routes/Login').then((module) => ({ default: module.LoginRoute })),
);
export const NotFoundRoute = lazy(() =>
  import('@routes/NotFound').then((module) => ({ default: module.NotFoundRoute })),
);
export const OAuthRoute = lazy(() =>
  import('@routes/OAuth').then((module) => ({ default: module.OAuthRoute })),
);
export const AuthRegister = lazy(() =>
  import('@routes/Registration').then((module) => ({ default: module.AuthRegister })),
);
