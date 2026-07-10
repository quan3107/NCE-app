/**
 * Location: src/routes/AppRoutes.tsx
 * Purpose: Define the React Router tree and enforce role-based access.
 * Why: Replace the custom router with declarative routes and centralized guards.
 */

import { Suspense, useEffect, useState, type ReactNode } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { AppShell } from '@components/layout/AppShell';
import { NavigationProvider } from '@features/navigation';
import type { Role } from '@domain';
import { useAuthStore } from '@store/authStore';
import { RouteLoading } from '@routes/RouteLoading';
import {
  AboutRoute,
  AdminAuditLogsPage,
  AdminCmsPage,
  AdminCoursesPage,
  AdminDashboardPage,
  AdminEnrollmentsPage,
  AdminSettingsPage,
  AdminUsersPage,
  AuthRegister,
  ContactRoute,
  CourseDetailRoute,
  CoursesRoute,
  DashboardStudentRoute,
  DashboardTeacherRoute,
  HomeRoute,
  LoginRoute,
  NotFoundRoute,
  OAuthRoute,
  StudentAssignmentDetailPage,
  StudentAssignmentsPage,
  StudentGradesPage,
  StudentNceLessonPage,
  StudentNcePathPage,
  StudentNotificationsPage,
  StudentProfilePage,
  TeacherAnalyticsPage,
  TeacherAssignmentDetailPage,
  TeacherAssignmentEditPage,
  TeacherAssignmentsPage,
  TeacherCourseManagement,
  TeacherCoursesPage,
  TeacherGradeFormPage,
  TeacherIeltsAssignmentCreatePage,
  TeacherNceLessonEditorPage,
  TeacherNceLessonsPage,
  TeacherProfilePage,
  TeacherRubricsPage,
  TeacherSubmissionsPage,
} from '@routes/lazyRouteComponents';
import {
  buildAuthReturnTo,
  resolveProtectedRouteAuthDecision,
} from '@lib/auth-restore';

const roleLanding: Record<Role, string> = {
  student: '/student/dashboard',
  teacher: '/teacher/dashboard',
  admin: '/admin/dashboard',
  public: '/',
};

const resolveLanding = (role: Role) => roleLanding[role] ?? '/';

function RequireAuth({ children }: { children: ReactNode }) {
  const {
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
          <Route path="admin/content" element={<AdminCmsPage />} />
          <Route path="admin/settings" element={<AdminSettingsPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
