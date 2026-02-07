/**
 * Location: src/routes/DashboardTeacher.tsx
 * Purpose: Provide the teacher dashboard route summarizing assignments and submissions.
 * Why: Keeps role-specific overview logic within the routing layer.
 */

import { useState } from 'react';
import { FileText, SlidersHorizontal } from 'lucide-react';
import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/card';
import { PageHeader } from '@components/common/PageHeader';
import { useRouter } from '@lib/router';
import { formatDistanceToNow } from '@lib/utils';
import { useTeacherAnalyticsQuery } from '@features/analytics/api';
import { useAssignmentResources } from '@features/assignments/api';
import { useCoursesQuery } from '@features/courses/api';
import { DashboardStatsGrid } from '@features/dashboard-config/components/DashboardStatsGrid';
import { DashboardWidgetEditor } from '@features/dashboard-config/components/DashboardWidgetEditor';
import type { DashboardWidget } from '@features/dashboard-config/types';
import { useDashboardConfig } from '@features/dashboard-config/useDashboardConfig';

export function DashboardTeacherRoute() {
  const { navigate } = useRouter();
  const [isWidgetEditorOpen, setIsWidgetEditorOpen] = useState(false);
  const dashboardConfig = useDashboardConfig();
  const { assignments, submissions, isLoading: assignmentsLoading, error: assignmentsError } =
    useAssignmentResources();
  const coursesQuery = useCoursesQuery();
  const analyticsQuery = useTeacherAnalyticsQuery();

  const isLoading = assignmentsLoading || coursesQuery.isLoading || analyticsQuery.isLoading;
  const error = assignmentsError ?? coursesQuery.error ?? analyticsQuery.error ?? null;

  const processedSubmissions = submissions.filter(
    submission => submission.status === 'submitted' || submission.status === 'late',
  );

  const openSubmissions = processedSubmissions.length;
  const avgTurnaround = analyticsQuery.data?.averageTurnaroundDays ?? null;
  const onTimeRate = analyticsQuery.data?.onTimeRate ?? null;
  const totalStudents = (coursesQuery.data ?? []).reduce(
    (sum, course) => sum + course.enrolled,
    0,
  );
  const widgetMetrics = {
    'teacher.assignments_active': assignments.filter((assignment) => assignment.status === 'published').length,
    'teacher.submissions_pending_grading': openSubmissions,
    'teacher.students_total': totalStudents,
    'teacher.submissions_on_time_rate': onTimeRate,
    'teacher.grading_average_turnaround_days': avgTurnaround,
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

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Dashboard" description="Welcome back! Here's your overview." />
        <div className="p-4 sm:p-6 lg:p-8">
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Loading teacher analytics...
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <PageHeader title="Dashboard" description="Welcome back! Here's your overview." />
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

  const courses = coursesQuery.data ?? [];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Welcome back! Here's your overview."
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
        <DashboardStatsGrid
          widgets={dashboardConfig.config?.widgets ?? []}
          metrics={widgetMetrics}
          gridClassName="grid sm:grid-cols-2 lg:grid-cols-5 gap-4"
        />

        <div className="grid lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Recent Submissions</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => navigate('/teacher/submissions')}>
                  View All
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {processedSubmissions.slice(0, 3).map(submission => {
                  const assignment = assignments.find(a => a.id === submission.assignmentId);
                  return (
                    <div key={submission.id} className="flex items-start gap-3 p-3 rounded-lg border">
                      <FileText className="size-4 mt-0.5 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{assignment?.title}</p>
                        <p className="text-sm text-muted-foreground">{submission.studentName}</p>
                        <Badge variant="secondary" className="text-xs mt-1">
                          {formatDistanceToNow(new Date(submission.submittedAt!), { addSuffix: true })}
                        </Badge>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => navigate(`/teacher/submissions/${submission.id}`)}>
                        Grade
                      </Button>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>My Courses</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => navigate('/teacher/courses')}>
                  View All
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {courses.map(course => (
                  <div key={course.id} className="p-3 rounded-lg border hover:bg-accent/50 cursor-pointer" onClick={() => navigate('/teacher/courses')}>
                    <h4 className="mb-1">{course.title}</h4>
                    <p className="text-sm text-muted-foreground">{course.enrolled} students enrolled</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
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



