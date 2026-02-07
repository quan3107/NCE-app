/**
 * Location: src/routes/DashboardStudent.tsx
 * Purpose: Present the student dashboard route summarizing assignments and progress metrics.
 * Why: Keeps route-level orchestration separate from feature components after restructuring.
 */

import { useState } from 'react';
import { SlidersHorizontal, TrendingUp } from 'lucide-react';
import { Button } from '@components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@components/ui/card';
import { PageHeader } from '@components/common/PageHeader';
import { Progress } from '@components/ui/progress';
import { useAuthStore } from '@store/authStore';
import { useRouter } from '@lib/router';
import { useAssignmentResources } from '@features/assignments/api';
import { DashboardStatsGrid } from '@features/dashboard-config/components/DashboardStatsGrid';
import { DashboardWidgetEditor } from '@features/dashboard-config/components/DashboardWidgetEditor';
import type { DashboardWidget } from '@features/dashboard-config/types';
import { useDashboardConfig } from '@features/dashboard-config/useDashboardConfig';
import {
  StudentDueSoonPanel,
  StudentEnrolledCoursesPanel,
  StudentRecentActivityPanel,
} from '@routes/DashboardStudentPanels';

export function DashboardStudentRoute() {
  const { navigate } = useRouter();
  const { currentUser } = useAuthStore();
  const [isWidgetEditorOpen, setIsWidgetEditorOpen] = useState(false);
  const dashboardConfig = useDashboardConfig();
  const {
    assignments,
    submissions,
    enrollments,
    courses,
    isLoading,
    error,
  } = useAssignmentResources();

  if (!currentUser) return null;

  if (isLoading) {
    return (
      <div>
        <PageHeader
          title="Dashboard"
          description="Welcome back! Here's an overview of your assignments and progress."
        />
        <div className="p-4 sm:p-6 lg:p-8">
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Loading dashboard metrics...
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <PageHeader
          title="Dashboard"
          description="Welcome back! Here's an overview of your assignments and progress."
        />
        <div className="p-4 sm:p-6 lg:p-8">
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-destructive font-medium">Unable to load dashboard data.</p>
              <p className="text-sm text-muted-foreground mt-2">{error.message}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Get student's enrolled courses
  const enrolledCourseIds = enrollments
    .filter(e => e.userId === currentUser.id)
    .map(e => e.courseId);

  // Get assignments for enrolled courses
  const studentAssignments = assignments.filter(a =>
    enrolledCourseIds.includes(a.courseId) && a.status === 'published'
  );

  // Get submissions for this student
  const studentSubmissions = submissions.filter(s => s.studentId === currentUser.id);

  // Calculate assignment statuses
  const now = new Date();
  const dueSoon = studentAssignments.filter(a => {
    const dueDate = new Date(a.dueAt);
    const hoursUntilDue = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60);
    const submission = studentSubmissions.find(s => s.assignmentId === a.id);
    return hoursUntilDue <= 48 && hoursUntilDue > 0 && !submission;
  });

  const assigned = studentAssignments.filter(a => {
    const submission = studentSubmissions.find(s => s.assignmentId === a.id);
    return !submission && new Date(a.dueAt) > now;
  });

  const completed = studentSubmissions.filter(s => s.status === 'graded').length;
  const late = studentSubmissions.filter(s => s.status === 'late').length;

  // Calculate completion rate
  const totalAssignments = studentAssignments.length;
  const completionRate = totalAssignments > 0 ? (completed / totalAssignments) * 100 : 0;
  const widgetMetrics = {
    'student.assignments_due_soon': dueSoon.length,
    'student.assignments_assigned': assigned.length,
    'student.assignments_completed': completed,
    'student.assignments_late': late,
  };

  const handleSaveWidgetConfig = async (widgets: DashboardWidget[]) => {
    await dashboardConfig.saveConfig({
      widgets: widgets.map((widget) => ({
        id: widget.id,
        visible: widget.visible,
        order: widget.order,
        position: widget.position,
      })),
    });
  };

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Welcome back! Here's an overview of your assignments and progress."
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setIsWidgetEditorOpen(true)}
            disabled={!dashboardConfig.config}
          >
            <SlidersHorizontal className="size-4" />
            Customize
          </Button>
        }
      />

      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Stats */}
        <DashboardStatsGrid
          widgets={dashboardConfig.config?.widgets ?? []}
          metrics={widgetMetrics}
          gridClassName="grid sm:grid-cols-2 lg:grid-cols-4 gap-4"
        />

        {/* Progress Overview */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Overall Progress</CardTitle>
                <CardDescription>Your completion rate across all courses</CardDescription>
              </div>
              <TrendingUp className="size-5 text-green-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Completion Rate</span>
                <span className="font-medium">{Math.round(completionRate)}%</span>
              </div>
              <Progress value={completionRate} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {completed} of {totalAssignments} assignments completed
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="grid lg:grid-cols-2 gap-6">
          <StudentDueSoonPanel dueSoon={dueSoon} now={now} navigate={navigate} />
          <StudentRecentActivityPanel
            studentSubmissions={studentSubmissions}
            studentAssignments={studentAssignments}
            navigate={navigate}
          />
        </div>

        <StudentEnrolledCoursesPanel
          courses={courses}
          enrolledCourseIds={enrolledCourseIds}
          studentAssignments={studentAssignments}
          navigate={navigate}
        />
      </div>

      {dashboardConfig.config && (
        <DashboardWidgetEditor
          open={isWidgetEditorOpen}
          onOpenChange={setIsWidgetEditorOpen}
          widgets={dashboardConfig.config.widgets}
          onSave={handleSaveWidgetConfig}
          onReset={dashboardConfig.resetConfig}
          isSaving={dashboardConfig.isSaving}
          isResetting={dashboardConfig.isResetting}
        />
      )}
    </div>
  );
}





