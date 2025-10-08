import { useEffect } from 'react';
import { Toaster } from './components/ui/sonner';
import { AuthProvider, useAuth } from './lib/auth-context';
import { RouterProvider, useRouter } from './lib/router';
import { AppShell } from './components/app-shell';

// Public pages
import { PublicHome } from './pages/public-home';
import { PublicCourses } from './pages/public-courses';
import { PublicCourseDetail } from './pages/public-course-detail';
import { PublicAbout } from './pages/public-about';
import { PublicContact } from './pages/public-contact';

// Auth pages
import { AuthLogin } from './pages/auth-login';
import { AuthOAuth } from './pages/auth-oauth';

// Student pages
import { StudentDashboard } from './pages/student-dashboard';
import { StudentAssignments } from './pages/student-assignments';
import { StudentAssignmentDetail } from './pages/student-assignment-detail';
import { StudentGrades } from './pages/student/student-grades';
import { StudentNotifications } from './pages/student/student-notifications';
import { StudentProfile } from './pages/student/student-profile';
import { TeacherDashboard } from './pages/teacher/teacher-dashboard';
import { TeacherAssignments } from './pages/teacher/teacher-assignments';
import { TeacherSubmissions } from './pages/teacher/teacher-submissions';
import { TeacherGradeForm } from './pages/teacher/teacher-grade-form';
import { TeacherCourses } from './pages/teacher/teacher-courses';
import { TeacherRubrics } from './pages/teacher/teacher-rubrics';
import { TeacherAnalytics } from './pages/teacher/teacher-analytics';
import { AdminDashboard } from './pages/admin/admin-dashboard';
import { AdminUsers } from './pages/admin/admin-users';
import { AdminCourses } from './pages/admin/admin-courses';
import { AdminEnrollments } from './pages/admin/admin-enrollments';
import { AdminAuditLogs } from './pages/admin/admin-audit-logs';
import { AdminSettings } from './pages/admin/admin-settings';

function AppContent() {
  const { currentPath, navigate } = useRouter();
  const { currentUser, isAuthenticated } = useAuth();

  // Auto-redirect based on auth state - only redirect from root path
  useEffect(() => {
    // Only redirect if on root path and authenticated
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

  // Redirect to login for protected routes
  useEffect(() => {
    const protectedRoutes = ['/student/', '/teacher/', '/admin/'];
    const isProtectedRoute = protectedRoutes.some(route => currentPath.startsWith(route));
    
    if (isProtectedRoute && !isAuthenticated) {
      navigate('/login');
    }
  }, [currentPath, isAuthenticated, navigate]);

  // Route rendering
  const renderRoute = () => {
    // Auth routes
    if (currentPath === '/login') return <AuthLogin />;
    if (currentPath === '/auth/oauth') return <AuthOAuth />;

    // Public routes
    if (currentPath === '/') return <PublicHome />;
    if (currentPath === '/about') return <PublicAbout />;
    if (currentPath === '/contact') return <PublicContact />;
    if (currentPath === '/courses') return <PublicCourses />;
    if (currentPath.startsWith('/courses/')) {
      const courseId = currentPath.split('/')[2];
      return <PublicCourseDetail courseId={courseId} />;
    }

    // Require auth for protected routes
    if (!isAuthenticated) {
      return <AuthLogin />;
    }

    // Student routes
    if (currentPath === '/student/dashboard') return <StudentDashboard />;
    if (currentPath === '/student/assignments') return <StudentAssignments />;
    if (currentPath.startsWith('/student/assignments/')) {
      const assignmentId = currentPath.split('/')[3];
      return <StudentAssignmentDetail assignmentId={assignmentId} />;
    }
    if (currentPath === '/student/grades') return <StudentGrades />;
    if (currentPath === '/student/notifications') return <StudentNotifications />;
    if (currentPath === '/student/profile') return <StudentProfile />;

    // Teacher routes
    if (currentPath === '/teacher/dashboard') return <TeacherDashboard />;
    if (currentPath === '/teacher/courses') return <TeacherCourses />;
    if (currentPath === '/teacher/assignments') return <TeacherAssignments />;
    if (currentPath.startsWith('/teacher/assignments/')) {
      return <TeacherAssignments />;
    }
    if (currentPath === '/teacher/submissions') return <TeacherSubmissions />;
    if (currentPath.startsWith('/teacher/grade/')) {
      const submissionId = currentPath.split('/')[3];
      return <TeacherGradeForm submissionId={submissionId} />;
    }
    if (currentPath === '/teacher/rubrics') return <TeacherRubrics />;
    if (currentPath === '/teacher/analytics') return <TeacherAnalytics />;

    // Admin routes
    if (currentPath === '/admin/dashboard') return <AdminDashboard />;
    if (currentPath === '/admin/users') return <AdminUsers />;
    if (currentPath === '/admin/courses') return <AdminCourses />;
    if (currentPath === '/admin/enrollments') return <AdminEnrollments />;
    if (currentPath === '/admin/logs') return <AdminAuditLogs />;
    if (currentPath === '/admin/settings') return <AdminSettings />;

    // 404
    return <PublicHome />;
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
