/**
 * Location: src/routes/DashboardTeacher.tsx
 * Purpose: Provide the teacher dashboard route summarizing assignments and submissions.
 * Why: Keeps role-specific overview logic within the routing layer.
 */

import { Clock, FileText, Gauge, Timer, Users } from 'lucide-react';
import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/card';
import { PageHeader } from '@components/common/PageHeader';
import { useRouter } from '@lib/router';
import { formatDistanceToNow } from '@lib/utils';
import { useTeacherAnalyticsQuery } from '@features/analytics/api';
import { useAssignmentResources } from '@features/assignments/api';
import { useCoursesQuery } from '@features/courses/api';

export function DashboardTeacherRoute() {
  const { navigate } = useRouter();
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
  const formatRate = (value: number | null) =>
    value === null ? 'N/A' : `${value.toFixed(1)}%`;
  const formatDays = (value: number | null) =>
    value === null ? 'N/A' : `${value.toFixed(1)} days`;

  const stats = [
    { label: 'Active Assignments', value: assignments.filter(a => a.status === 'published').length, icon: <FileText className="size-5" /> },
    { label: 'Pending Grading', value: openSubmissions, icon: <Clock className="size-5 text-orange-500" /> },
    { label: 'Total Students', value: totalStudents, icon: <Users className="size-5 text-blue-500" /> },
    { label: 'On-time Rate', value: formatRate(onTimeRate), icon: <Gauge className="size-5 text-blue-500" /> },
    { label: 'Avg Turnaround', value: formatDays(avgTurnaround), icon: <Timer className="size-5 text-green-500" /> },
  ];

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
      <PageHeader title="Dashboard" description="Welcome back! Here's your overview." />
      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {stats.map((stat, index) => (
            <Card key={index}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <p className="text-3xl font-medium mt-1">{stat.value}</p>
                  </div>
                  <div>{stat.icon}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

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
    </div>
  );
}



