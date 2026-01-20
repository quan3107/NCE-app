/**
 * Location: src/App.tsx
 * Purpose: Compose global providers and render the app shell with route-aware content.
 * Why: Centralizes navigation decisions while delegating UI to feature and route modules.
 */

import { ReactNode, useEffect } from 'react';
import { AppShell } from '@components/layout/AppShell';
import { Toaster } from '@components/ui/sonner';
import { AdminAuditLogsPage } from '@features/admin/components/AdminAuditLogsPage';
import { AdminCoursesPage } from '@features/admin/components/AdminCoursesPage';
import { AdminDashboardPage } from '@features/admin/components/AdminDashboardPage';
import { AdminEnrollmentsPage } from '@features/admin/components/AdminEnrollmentsPage';
import { AdminSettingsPage } from '@features/admin/components/AdminSettingsPage';
import { AdminUsersPage } from '@features/admin/components/AdminUsersPage';
import { TeacherAnalyticsPage } from '@features/analytics/components/TeacherAnalyticsPage';
import { StudentAssignmentDetailPage } from '@features/assignments/components/StudentAssignmentDetailPage';
import { StudentAssignmentsPage } from '@features/assignments/components/StudentAssignmentsPage';
import { TeacherAssignmentsPage } from '@features/assignments/components/TeacherAssignmentsPage';
import { TeacherGradeFormPage } from '@features/assignments/components/TeacherGradeFormPage';
import { TeacherSubmissionsPage } from '@features/assignments/components/TeacherSubmissionsPage';
import { TeacherCoursesPage } from '@features/courses/components/TeacherCoursesPage';
import { TeacherCourseManagement } from '@features/courses/management/TeacherCourseManagement';
import { StudentGradesPage } from '@features/grades/components/StudentGradesPage';
import { StudentNotificationsPage } from '@features/notifications/components/StudentNotificationsPage';
import { StudentProfilePage } from '@features/profile/components/StudentProfilePage';
import { TeacherRubricsPage } from '@features/rubrics/components/TeacherRubricsPage';
import { AuthProvider } from '@lib/auth';
import { RouterProvider, useRouter } from '@lib/router';
import { useAuthStore } from '@store/authStore';
import { AboutRoute } from '@routes/About';
import { ContactRoute } from '@routes/Contact';
import { CourseDetailRoute } from '@routes/CourseDetail';
import { CoursesRoute } from '@routes/Courses';
import { DashboardStudentRoute } from '@routes/DashboardStudent';
import { DashboardTeacherRoute } from '@routes/DashboardTeacher';
import { HomeRoute } from '@routes/Home';
import { LoginRoute } from '@routes/Login';
import { AuthRegister } from '@routes/Registration';
import { NotFoundRoute } from '@routes/NotFound';
import { OAuthRoute } from '@routes/OAuth';

function AppContent() {
  const { currentPath, navigate } = useRouter();
  const { currentUser, isAuthenticated } = useAuthStore();

  type RouteResolution = {
    element: ReactNode;
    variant: 'public' | 'app';
  };

  useEffect(() => {
    if (isAuthenticated && currentUser && currentPath === '/') {
      if (currentUser.role === 'student') {
        navigate('/student/dashboard');
      } else if (currentUser.role === 'teacher') {
        navigate('/teacher/dashboard');
      } else if (currentUser.role === 'admin') {
        navigate('/admin/dashboard');
      }
    }
  }, [isAuthenticated, currentUser, currentPath, navigate]);

  useEffect(() => {
    const protectedRoutes = ['/student/', '/teacher/', '/admin/'];
    const isProtectedRoute = protectedRoutes.some(route => currentPath.startsWith(route));

    if (isProtectedRoute && !isAuthenticated) {
      navigate('/login');
    }
  }, [currentPath, isAuthenticated, navigate]);

  const resolveRoute = (): RouteResolution => {
    if (currentPath === '/login') {
      return { element: <LoginRoute />, variant: 'public' };
    }
    if (currentPath === '/auth/oauth') {
      return { element: <OAuthRoute />, variant: 'public' };
    }
    if (currentPath === '/register') {
      return { element: <AuthRegister />, variant: 'public' };
    }

    if (currentPath === '/') {
      return { element: <HomeRoute />, variant: 'public' };
    }
    if (currentPath === '/about') {
      return { element: <AboutRoute />, variant: 'public' };
    }
    if (currentPath === '/contact') {
      return { element: <ContactRoute />, variant: 'public' };
    }
    if (currentPath === '/courses') {
      return { element: <CoursesRoute />, variant: 'public' };
    }
    if (currentPath.startsWith('/courses/')) {
      const courseId = currentPath.split('/')[2];
      return { element: <CourseDetailRoute courseId={courseId} />, variant: 'public' };
    }

    if (!isAuthenticated) {
      return { element: <LoginRoute />, variant: 'public' };
    }

    if (currentPath === '/student/dashboard') {
      return { element: <DashboardStudentRoute />, variant: 'app' };
    }
    if (currentPath === '/student/assignments') {
      return { element: <StudentAssignmentsPage />, variant: 'app' };
    }
    if (currentPath.startsWith('/student/assignments/')) {
      const assignmentId = currentPath.split('/')[3];
      return { element: <StudentAssignmentDetailPage assignmentId={assignmentId} />, variant: 'app' };
    }
    if (currentPath === '/student/grades') {
      return { element: <StudentGradesPage />, variant: 'app' };
    }
    if (currentPath === '/student/notifications') {
      return { element: <StudentNotificationsPage />, variant: 'app' };
    }
    if (currentPath === '/student/profile') {
      return { element: <StudentProfilePage />, variant: 'app' };
    }

    if (currentPath === '/teacher/dashboard') {
      return { element: <DashboardTeacherRoute />, variant: 'app' };
    }
    if (currentPath === '/teacher/courses') {
      return { element: <TeacherCoursesPage />, variant: 'app' };
    }
    if (currentPath.startsWith('/teacher/courses/') && currentPath.endsWith('/manage')) {
      const managePrefix = '/teacher/courses/';
      const manageSuffix = '/manage';
      const courseId = currentPath.slice(managePrefix.length, -manageSuffix.length);
      if (courseId) {
        return { element: <TeacherCourseManagement courseId={courseId} />, variant: 'app' };
      }
    }
    if (currentPath === '/teacher/assignments') {
      return { element: <TeacherAssignmentsPage />, variant: 'app' };
    }
    if (currentPath.startsWith('/teacher/assignments/')) {
      return { element: <TeacherAssignmentsPage />, variant: 'app' };
    }
    if (currentPath === '/teacher/submissions') {
      return { element: <TeacherSubmissionsPage />, variant: 'app' };
    }
    if (currentPath.startsWith('/teacher/grade/')) {
      const submissionId = currentPath.split('/')[3];
      return { element: <TeacherGradeFormPage submissionId={submissionId} />, variant: 'app' };
    }
    if (currentPath === '/teacher/rubrics') {
      return { element: <TeacherRubricsPage />, variant: 'app' };
    }
    if (currentPath === '/teacher/analytics') {
      return { element: <TeacherAnalyticsPage />, variant: 'app' };
    }

    if (currentPath === '/admin/dashboard') {
      return { element: <AdminDashboardPage />, variant: 'app' };
    }
    if (currentPath === '/admin/users') {
      return { element: <AdminUsersPage />, variant: 'app' };
    }
    if (currentPath === '/admin/courses') {
      return { element: <AdminCoursesPage />, variant: 'app' };
    }
    if (currentPath === '/admin/enrollments') {
      return { element: <AdminEnrollmentsPage />, variant: 'app' };
    }
    if (currentPath === '/admin/logs') {
      return { element: <AdminAuditLogsPage />, variant: 'app' };
    }
    if (currentPath === '/admin/settings') {
      return { element: <AdminSettingsPage />, variant: 'app' };
    }

    return { element: <NotFoundRoute />, variant: 'public' };
  };

  const { element, variant } = resolveRoute();

  return (
    <AppShell variant={variant}>
      {element}
    </AppShell>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <RouterProvider>
        <AppContent />
        <Toaster position="top-right" />
      </RouterProvider>
    </AuthProvider>
  );
}



