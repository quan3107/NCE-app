/**
 * Location: src/routes/AppRoutes.tsx
 * Purpose: Define the React Router tree and enforce role-based access.
 * Why: Replace the custom router with declarative routes and centralized guards.
 */

import { Suspense, lazy, useEffect, useState, type ReactNode } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { AppShell } from '@components/layout/AppShell';
import { NavigationProvider } from '@features/navigation';
import type { Role } from '@domain';
import { useAuthStore } from '@store/authStore';
import { RouteLoading } from '@routes/RouteLoading';
import {
  buildAuthReturnTo,
  resolveProtectedRouteAuthDecision,
} from '@lib/auth-restore';

const AdminAuditLogsPage = lazy(() =>
  import('@features/admin/components/AdminAuditLogsPage').then((module) => ({ default: module.AdminAuditLogsPage })),
);
const AdminCoursesPage = lazy(() =>
  import('@features/admin/components/AdminCoursesPage').then((module) => ({ default: module.AdminCoursesPage })),
);
const AdminDashboardPage = lazy(() =>
  import('@features/admin/components/AdminDashboardPage').then((module) => ({ default: module.AdminDashboardPage })),
);
const AdminEnrollmentsPage = lazy(() =>
  import('@features/admin/components/AdminEnrollmentsPage').then((module) => ({ default: module.AdminEnrollmentsPage })),
);
const AdminSettingsPage = lazy(() =>
  import('@features/admin/components/AdminSettingsPage').then((module) => ({ default: module.AdminSettingsPage })),
);
const AdminUsersPage = lazy(() =>
  import('@features/admin/components/AdminUsersPage').then((module) => ({ default: module.AdminUsersPage })),
);
const TeacherAnalyticsPage = lazy(() =>
  import('@features/analytics/components/TeacherAnalyticsPage').then((module) => ({ default: module.TeacherAnalyticsPage })),
);
const StudentAssignmentDetailPage = lazy(() =>
  import('@features/assignments/components/StudentAssignmentDetailPage').then((module) => ({
    default: module.StudentAssignmentDetailPage,
  })),
);
const StudentAssignmentsPage = lazy(() =>
  import('@features/assignments/components/StudentAssignmentsPage').then((module) => ({ default: module.StudentAssignmentsPage })),
);
const TeacherAssignmentDetailPage = lazy(() =>
  import('@features/assignments/components/TeacherAssignmentDetailPage').then((module) => ({
    default: module.TeacherAssignmentDetailPage,
  })),
);
const TeacherAssignmentEditPage = lazy(() =>
  import('@features/assignments/components/TeacherAssignmentEditPage').then((module) => ({
    default: module.TeacherAssignmentEditPage,
  })),
);
const TeacherAssignmentsPage = lazy(() =>
  import('@features/assignments/components/TeacherAssignmentsPage').then((module) => ({ default: module.TeacherAssignmentsPage })),
);
const TeacherIeltsAssignmentCreatePage = lazy(() =>
  import('@features/assignments/components/TeacherIeltsAssignmentCreatePage').then((module) => ({
    default: module.TeacherIeltsAssignmentCreatePage,
  })),
);
const TeacherGradeFormPage = lazy(() =>
  import('@features/assignments/components/TeacherGradeFormPage').then((module) => ({ default: module.TeacherGradeFormPage })),
);
const TeacherSubmissionsPage = lazy(() =>
  import('@features/assignments/components/TeacherSubmissionsPage').then((module) => ({ default: module.TeacherSubmissionsPage })),
);
const TeacherCoursesPage = lazy(() =>
  import('@features/courses/components/TeacherCoursesPage').then((module) => ({ default: module.TeacherCoursesPage })),
);
const TeacherCourseManagement = lazy(() =>
  import('@features/courses/management/TeacherCourseManagement').then((module) => ({ default: module.TeacherCourseManagement })),
);
const TeacherNceLessonEditorPage = lazy(() =>
  import('@features/nce-content/components/TeacherNceLessonEditorPage').then((module) => ({
    default: module.TeacherNceLessonEditorPage,
  })),
);
const TeacherNceLessonsPage = lazy(() =>
  import('@features/nce-content/components/TeacherNceLessonsPage').then((module) => ({ default: module.TeacherNceLessonsPage })),
);
const StudentNceLessonPage = lazy(() =>
  import('@features/nce-learning/components/StudentNceLessonPage').then((module) => ({ default: module.StudentNceLessonPage })),
);
const StudentNcePathPage = lazy(() =>
  import('@features/nce-learning/components/StudentNcePathPage').then((module) => ({ default: module.StudentNcePathPage })),
);
const StudentGradesPage = lazy(() =>
  import('@features/grades/components/StudentGradesPage').then((module) => ({ default: module.StudentGradesPage })),
);
const StudentNotificationsPage = lazy(() =>
  import('@features/notifications/components/StudentNotificationsPage').then((module) => ({
    default: module.StudentNotificationsPage,
  })),
);
const StudentProfilePage = lazy(() =>
  import('@features/profile/components/StudentProfilePage').then((module) => ({ default: module.StudentProfilePage })),
);
const TeacherProfilePage = lazy(() =>
  import('@features/profile/components/TeacherProfilePage').then((module) => ({ default: module.TeacherProfilePage })),
);
const TeacherRubricsPage = lazy(() =>
  import('@features/rubrics/components/TeacherRubricsPage').then((module) => ({ default: module.TeacherRubricsPage })),
);
const AboutRoute = lazy(() =>
  import('@routes/About').then((module) => ({ default: module.AboutRoute })),
);
const ContactRoute = lazy(() =>
  import('@routes/Contact').then((module) => ({ default: module.ContactRoute })),
);
const CourseDetailRoute = lazy(() =>
  import('@routes/CourseDetail').then((module) => ({ default: module.CourseDetailRoute })),
);
const CoursesRoute = lazy(() =>
  import('@routes/Courses').then((module) => ({ default: module.CoursesRoute })),
);
const DashboardStudentRoute = lazy(() =>
  import('@routes/DashboardStudent').then((module) => ({ default: module.DashboardStudentRoute })),
);
const DashboardTeacherRoute = lazy(() =>
  import('@routes/DashboardTeacher').then((module) => ({ default: module.DashboardTeacherRoute })),
);
const HomeRoute = lazy(() =>
  import('@routes/Home').then((module) => ({ default: module.HomeRoute })),
);
const LoginRoute = lazy(() =>
  import('@routes/Login').then((module) => ({ default: module.LoginRoute })),
);
const NotFoundRoute = lazy(() =>
  import('@routes/NotFound').then((module) => ({ default: module.NotFoundRoute })),
);
const OAuthRoute = lazy(() =>
  import('@routes/OAuth').then((module) => ({ default: module.OAuthRoute })),
);
const AuthRegister = lazy(() =>
  import('@routes/Registration').then((module) => ({ default: module.AuthRegister })),
);

const roleLanding: Record<Role, string> = {
  student: '/student/dashboard',
  teacher: '/teacher/dashboard',
  admin: '/admin/dashboard',
  public: '/',
};

const resolveLanding = (role: Role) => roleLanding[role] ?? '/';

function RequireAuth({ children }: { children: ReactNode }) {
  const {
    authMode,
    isAuthenticated,
    isRestoringSession,
    currentUser,
    restoreLiveSession,
  } = useAuthStore();
  const location = useLocation();
  const returnTo = buildAuthReturnTo(location);
  const [restoreAttemptedFor, setRestoreAttemptedFor] = useState<string | null>(null);
  const restoreAttempted = restoreAttemptedFor === returnTo;
  const decision = resolveProtectedRouteAuthDecision({
    authMode,
    currentUserRole: currentUser.role,
    isAuthenticated,
    isRestoringSession,
    requiresAuth: true,
    restoreAttempted,
  });

  useEffect(() => {
    if (decision !== 'restore') {
      return;
    }

    setRestoreAttemptedFor(returnTo);
    void restoreLiveSession();
  }, [decision, restoreLiveSession, returnTo]);

  if (decision === 'loading' || decision === 'restore') {
    return <RouteLoading />;
  }

  if (decision === 'redirect') {
    return <Navigate to="/login" replace state={{ from: returnTo }} />;
  }

  return <>{children}</>;
}

function RoleGuard({ allowedRoles }: { allowedRoles: Role[] }) {
  const { currentUser } = useAuthStore();
  const location = useLocation();

  // Redirect authenticated users to their home if they hit a different role area.
  if (!allowedRoles.includes(currentUser.role)) {
    return <Navigate to={resolveLanding(currentUser.role)} replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}

function PublicLayout() {
  return (
    <AppShell variant="public">
      <Suspense fallback={<RouteLoading />}>
        <Outlet />
      </Suspense>
    </AppShell>
  );
}

function AppLayout() {
  return (
    <RequireAuth>
      <NavigationProvider>
        <AppShell variant="app">
          <Suspense fallback={<RouteLoading />}>
            <Outlet />
          </Suspense>
        </AppShell>
      </NavigationProvider>
    </RequireAuth>
  );
}

function HomeGate() {
  // Allow authenticated users to revisit the marketing homepage.
  return <HomeRoute />;
}

function CourseDetailWrapper() {
  const { courseId = '' } = useParams<{ courseId: string }>();
  return <CourseDetailRoute courseId={courseId} />;
}

function StudentAssignmentDetailWrapper() {
  const { assignmentId = '' } = useParams<{ assignmentId: string }>();
  return <StudentAssignmentDetailPage assignmentId={assignmentId} />;
}

function TeacherGradeFormWrapper() {
  const { submissionId = '' } = useParams<{ submissionId: string }>();
  return <TeacherGradeFormPage submissionId={submissionId} />;
}

function TeacherAssignmentDetailWrapper() {
  const { assignmentId = '' } = useParams<{ assignmentId: string }>();
  return <TeacherAssignmentDetailPage assignmentId={assignmentId} />;
}

function TeacherAssignmentEditWrapper() {
  const { assignmentId = '' } = useParams<{ assignmentId: string }>();
  return <TeacherAssignmentEditPage assignmentId={assignmentId} />;
}

function TeacherCourseManagementWrapper() {
  const { courseId = '' } = useParams<{ courseId: string }>();
  return <TeacherCourseManagement courseId={courseId} />;
}

function TeacherNceLessonEditorWrapper() {
  const { lessonId } = useParams<{ lessonId?: string }>();
  return <TeacherNceLessonEditorPage lessonId={lessonId} />;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<HomeGate />} />
        <Route path="login" element={<LoginRoute />} />
        <Route path="register" element={<AuthRegister />} />
        <Route path="auth/oauth" element={<OAuthRoute />} />
        <Route path="about" element={<AboutRoute />} />
        <Route path="contact" element={<ContactRoute />} />
        <Route path="courses" element={<CoursesRoute />} />
        <Route path="courses/:courseId" element={<CourseDetailWrapper />} />
        <Route path="*" element={<NotFoundRoute />} />
      </Route>

      <Route element={<AppLayout />}>
        <Route element={<RoleGuard allowedRoles={['student']} />}>
          <Route path="student/dashboard" element={<DashboardStudentRoute />} />
          <Route path="student/assignments" element={<StudentAssignmentsPage />} />
          <Route path="student/assignments/:assignmentId" element={<StudentAssignmentDetailWrapper />} />
          <Route path="student/nce" element={<StudentNcePathPage />} />
          <Route path="student/nce/courses/:courseId/lessons/:lessonId" element={<StudentNceLessonPage />} />
          <Route path="student/grades" element={<StudentGradesPage />} />
          <Route path="student/notifications" element={<StudentNotificationsPage />} />
          <Route path="student/profile" element={<StudentProfilePage />} />
        </Route>

        <Route element={<RoleGuard allowedRoles={['teacher']} />}>
          <Route path="teacher/dashboard" element={<DashboardTeacherRoute />} />
          <Route path="teacher/courses" element={<TeacherCoursesPage />} />
          <Route path="teacher/courses/:courseId/manage" element={<TeacherCourseManagementWrapper />} />
          <Route path="teacher/nce-lessons" element={<TeacherNceLessonsPage />} />
          <Route path="teacher/nce-lessons/new" element={<TeacherNceLessonEditorWrapper />} />
          <Route path="teacher/nce-lessons/:lessonId/edit" element={<TeacherNceLessonEditorWrapper />} />
          <Route path="teacher/assignments" element={<TeacherAssignmentsPage />} />
          <Route path="teacher/assignments/create" element={<TeacherIeltsAssignmentCreatePage />} />
          <Route path="teacher/assignments/:assignmentId" element={<TeacherAssignmentDetailWrapper />} />
          <Route path="teacher/assignments/:assignmentId/detail" element={<TeacherAssignmentDetailWrapper />} />
          <Route path="teacher/assignments/:assignmentId/edit" element={<TeacherAssignmentEditWrapper />} />
          <Route path="teacher/submissions" element={<TeacherSubmissionsPage />} />
          <Route path="teacher/notifications" element={<StudentNotificationsPage />} />
          <Route path="teacher/grade/:submissionId" element={<TeacherGradeFormWrapper />} />
          <Route path="teacher/rubrics" element={<TeacherRubricsPage />} />
          <Route path="teacher/analytics" element={<TeacherAnalyticsPage />} />
          <Route path="teacher/profile" element={<TeacherProfilePage />} />
        </Route>

        <Route element={<RoleGuard allowedRoles={['admin']} />}>
          <Route path="admin/dashboard" element={<AdminDashboardPage />} />
          <Route path="admin/users" element={<AdminUsersPage />} />
          <Route path="admin/courses" element={<AdminCoursesPage />} />
          <Route path="admin/enrollments" element={<AdminEnrollmentsPage />} />
          <Route path="admin/logs" element={<AdminAuditLogsPage />} />
          <Route path="admin/settings" element={<AdminSettingsPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
