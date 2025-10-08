/**
 * Location: src/App.tsx
 * Purpose: Compose global providers and render the app shell with route-aware content.
 * Why: Centralizes navigation decisions while delegating UI to feature and route modules.
 */

import { useEffect } from 'react';
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
import { NotFoundRoute } from '@routes/NotFound';
import { OAuthRoute } from '@routes/OAuth';

function AppContent() {
  const { currentPath, navigate } = useRouter();
  const { currentUser, isAuthenticated } = useAuthStore();

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

  const renderRoute = () => {
    if (currentPath === '/login') return <LoginRoute />;
    if (currentPath === '/auth/oauth') return <OAuthRoute />;

    if (currentPath === '/') return <HomeRoute />;
    if (currentPath === '/about') return <AboutRoute />;
    if (currentPath === '/contact') return <ContactRoute />;
    if (currentPath === '/courses') return <CoursesRoute />;
    if (currentPath.startsWith('/courses/')) {
      const courseId = currentPath.split('/')[2];
      return <CourseDetailRoute courseId={courseId} />;
    }

    if (!isAuthenticated) {
      return <LoginRoute />;
    }

    if (currentPath === '/student/dashboard') return <DashboardStudentRoute />;
    if (currentPath === '/student/assignments') return <StudentAssignmentsPage />;
    if (currentPath.startsWith('/student/assignments/')) {
      const assignmentId = currentPath.split('/')[3];
      return <StudentAssignmentDetailPage assignmentId={assignmentId} />;
    }
    if (currentPath === '/student/grades') return <StudentGradesPage />;
    if (currentPath === '/student/notifications') return <StudentNotificationsPage />;
    if (currentPath === '/student/profile') return <StudentProfilePage />;

    if (currentPath === '/teacher/dashboard') return <DashboardTeacherRoute />;
    if (currentPath === '/teacher/courses') return <TeacherCoursesPage />;
    if (currentPath === '/teacher/assignments') return <TeacherAssignmentsPage />;
    if (currentPath.startsWith('/teacher/assignments/')) {
      return <TeacherAssignmentsPage />;
    }
    if (currentPath === '/teacher/submissions') return <TeacherSubmissionsPage />;
    if (currentPath.startsWith('/teacher/grade/')) {
      const submissionId = currentPath.split('/')[3];
      return <TeacherGradeFormPage submissionId={submissionId} />;
    }
    if (currentPath === '/teacher/rubrics') return <TeacherRubricsPage />;
    if (currentPath === '/teacher/analytics') return <TeacherAnalyticsPage />;

    if (currentPath === '/admin/dashboard') return <AdminDashboardPage />;
    if (currentPath === '/admin/users') return <AdminUsersPage />;
    if (currentPath === '/admin/courses') return <AdminCoursesPage />;
    if (currentPath === '/admin/enrollments') return <AdminEnrollmentsPage />;
    if (currentPath === '/admin/logs') return <AdminAuditLogsPage />;
    if (currentPath === '/admin/settings') return <AdminSettingsPage />;

    return <NotFoundRoute />;
  };

  return (
    <AppShell>
      {renderRoute()}
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



