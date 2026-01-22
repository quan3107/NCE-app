/**
 * Location: src/routes/AppRoutes.tsx
 * Purpose: Define the React Router tree and enforce role-based access.
 * Why: Replace the custom router with declarative routes and centralized guards.
 */

import { ReactNode } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { AppShell } from '@components/layout/AppShell';
import { AdminAuditLogsPage } from '@features/admin/components/AdminAuditLogsPage';
import { AdminCoursesPage } from '@features/admin/components/AdminCoursesPage';
import { AdminDashboardPage } from '@features/admin/components/AdminDashboardPage';
import { AdminEnrollmentsPage } from '@features/admin/components/AdminEnrollmentsPage';
import { AdminSettingsPage } from '@features/admin/components/AdminSettingsPage';
import { AdminUsersPage } from '@features/admin/components/AdminUsersPage';
import { TeacherAnalyticsPage } from '@features/analytics/components/TeacherAnalyticsPage';
import { StudentAssignmentDetailPage } from '@features/assignments/components/StudentAssignmentDetailPage';
import { StudentAssignmentsPage } from '@features/assignments/components/StudentAssignmentsPage';
import { TeacherAssignmentEditPage } from '@features/assignments/components/TeacherAssignmentEditPage';
import { TeacherAssignmentsPage } from '@features/assignments/components/TeacherAssignmentsPage';
import { TeacherGradeFormPage } from '@features/assignments/components/TeacherGradeFormPage';
import { TeacherSubmissionsPage } from '@features/assignments/components/TeacherSubmissionsPage';
import { TeacherCoursesPage } from '@features/courses/components/TeacherCoursesPage';
import { TeacherCourseManagement } from '@features/courses/management/TeacherCourseManagement';
import { StudentGradesPage } from '@features/grades/components/StudentGradesPage';
import { StudentNotificationsPage } from '@features/notifications/components/StudentNotificationsPage';
import { StudentProfilePage } from '@features/profile/components/StudentProfilePage';
import { TeacherRubricsPage } from '@features/rubrics/components/TeacherRubricsPage';
import { Role } from '@lib/mock-data';
import { useAuthStore } from '@store/authStore';
import { AboutRoute } from '@routes/About';
import { ContactRoute } from '@routes/Contact';
import { CourseDetailRoute } from '@routes/CourseDetail';
import { CoursesRoute } from '@routes/Courses';
import { DashboardStudentRoute } from '@routes/DashboardStudent';
import { DashboardTeacherRoute } from '@routes/DashboardTeacher';
import { HomeRoute } from '@routes/Home';
import { LoginRoute } from '@routes/Login';
import { NotFoundRoute } from '@routes/NotFound';
import { OAuthRoute } from '@routes/OAuth';
import { AuthRegister } from '@routes/Registration';

const roleLanding: Record<Role, string> = {
  student: '/student/dashboard',
  teacher: '/teacher/dashboard',
  admin: '/admin/dashboard',
  public: '/',
};

const resolveLanding = (role: Role) => roleLanding[role] ?? '/';

function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated, currentUser } = useAuthStore();
  const location = useLocation();

  // Guard protected areas from unauthenticated sessions.
  if (!isAuthenticated || currentUser.role === 'public') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
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
      <Outlet />
    </AppShell>
  );
}

function AppLayout() {
  return (
    <RequireAuth>
      <AppShell variant="app">
        <Outlet />
      </AppShell>
    </RequireAuth>
  );
}

function HomeGate() {
  const { isAuthenticated, currentUser } = useAuthStore();

  if (!isAuthenticated || currentUser.role === 'public') {
    return <HomeRoute />;
  }

  return <Navigate to={resolveLanding(currentUser.role)} replace />;
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

function TeacherAssignmentEditWrapper() {
  const { assignmentId = '' } = useParams<{ assignmentId: string }>();
  return <TeacherAssignmentEditPage assignmentId={assignmentId} />;
}

function TeacherCourseManagementWrapper() {
  const { courseId = '' } = useParams<{ courseId: string }>();
  return <TeacherCourseManagement courseId={courseId} />;
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
          <Route path="student/grades" element={<StudentGradesPage />} />
          <Route path="student/notifications" element={<StudentNotificationsPage />} />
          <Route path="student/profile" element={<StudentProfilePage />} />
        </Route>

        <Route element={<RoleGuard allowedRoles={['teacher']} />}>
          <Route path="teacher/dashboard" element={<DashboardTeacherRoute />} />
          <Route path="teacher/courses" element={<TeacherCoursesPage />} />
          <Route path="teacher/courses/:courseId/manage" element={<TeacherCourseManagementWrapper />} />
          <Route path="teacher/assignments" element={<TeacherAssignmentsPage />} />
          <Route path="teacher/assignments/:assignmentId" element={<TeacherAssignmentEditWrapper />} />
          <Route path="teacher/assignments/:assignmentId/edit" element={<TeacherAssignmentEditWrapper />} />
          <Route path="teacher/submissions" element={<TeacherSubmissionsPage />} />
          <Route path="teacher/grade/:submissionId" element={<TeacherGradeFormWrapper />} />
          <Route path="teacher/rubrics" element={<TeacherRubricsPage />} />
          <Route path="teacher/analytics" element={<TeacherAnalyticsPage />} />
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
