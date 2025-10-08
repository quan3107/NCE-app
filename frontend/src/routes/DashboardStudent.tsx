/**
 * Location: src/routes/DashboardStudent.tsx
 * Purpose: Present the student dashboard route summarizing assignments and progress metrics.
 * Why: Keeps route-level orchestration separate from feature components after restructuring.
 */

import { AlertCircle, CheckCircle2, Clock, FileText, TrendingUp } from 'lucide-react';
import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@components/ui/card';
import { PageHeader } from '@components/common/PageHeader';
import { Progress } from '@components/ui/progress';
import { useAuthStore } from '@store/authStore';
import { useRouter } from '@lib/router';
import { formatDistanceToNow } from '@lib/utils';
import { useAssignmentResources } from '@features/assignments/api';

export function DashboardStudentRoute() {
  const { navigate } = useRouter();
  const { currentUser } = useAuthStore();
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

  const stats = [
    { label: 'Due Soon', value: dueSoon.length, icon: <Clock className="size-5" />, color: 'text-orange-500' },
    { label: 'Assigned', value: assigned.length, icon: <FileText className="size-5" />, color: 'text-blue-500' },
    { label: 'Completed', value: completed, icon: <CheckCircle2 className="size-5" />, color: 'text-green-500' },
    { label: 'Late', value: late, icon: <AlertCircle className="size-5" />, color: 'text-red-500' },
  ];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Welcome back! Here's an overview of your assignments and progress."
      />

      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Stats */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, index) => (
            <Card key={index}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <p className="text-3xl font-medium mt-1">{stat.value}</p>
                  </div>
                  <div className={`${stat.color}`}>{stat.icon}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

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
          {/* Due Soon */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Due Soon</CardTitle>
                  <CardDescription>Assignments due within 48 hours</CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={() => navigate('/student/assignments')}>
                  View All
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {dueSoon.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle2 className="size-12 mx-auto mb-2 text-green-500" />
                  <p>All caught up! No urgent deadlines.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {dueSoon.slice(0, 3).map(assignment => {
                    const hoursUntilDue = (new Date(assignment.dueAt).getTime() - now.getTime()) / (1000 * 60 * 60);
                    const urgent = hoursUntilDue <= 24;

                    return (
                      <div
                        key={assignment.id}
                        className="flex items-start gap-3 p-3 rounded-lg border hover:bg-accent/50 cursor-pointer transition-colors"
                        onClick={() => navigate(`/student/assignments/${assignment.id}`)}
                      >
                        <div className={`mt-0.5 ${urgent ? 'text-red-500' : 'text-orange-500'}`}>
                          <Clock className="size-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{assignment.title}</p>
                          <p className="text-sm text-muted-foreground">{assignment.courseName}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant={urgent ? 'destructive' : 'secondary'} className="text-xs">
                              Due {formatDistanceToNow(new Date(assignment.dueAt), { addSuffix: true })}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Grades */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Recent Activity</CardTitle>
                  <CardDescription>Latest submissions and grades</CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={() => navigate('/student/grades')}>
                  View All
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {studentSubmissions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="size-12 mx-auto mb-2" />
                  <p>No submissions yet</p>
                  <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate('/student/assignments')}>
                    View Assignments
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {studentSubmissions.slice(0, 3).map(submission => {
                    const assignment = studentAssignments.find(a => a.id === submission.assignmentId);
                    if (!assignment) return null;

                    return (
                      <div
                        key={submission.id}
                        className="flex items-start gap-3 p-3 rounded-lg border hover:bg-accent/50 cursor-pointer transition-colors"
                        onClick={() => navigate('/student/grades')}
                      >
                        <div className="mt-0.5">
                          {submission.status === 'graded' ? (
                            <CheckCircle2 className="size-4 text-green-500" />
                          ) : submission.status === 'late' ? (
                            <AlertCircle className="size-4 text-red-500" />
                          ) : (
                            <FileText className="size-4 text-blue-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{assignment.title}</p>
                          <p className="text-sm text-muted-foreground">{assignment.courseName}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary" className="text-xs capitalize">
                              {submission.status.replace('_', ' ')}
                            </Badge>
                            {submission.submittedAt && (
                              <span className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(submission.submittedAt), { addSuffix: true })}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Enrolled Courses */}
        <Card>
          <CardHeader>
            <CardTitle>My Courses</CardTitle>
            <CardDescription>Courses you're currently enrolled in</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4">
              {courses
                .filter(c => enrolledCourseIds.includes(c.id))
                .map(course => (
                  <div
                    key={course.id}
                    className="p-4 rounded-lg border hover:bg-accent/50 cursor-pointer transition-colors"
                    onClick={() => navigate('/courses/' + course.id)}
                  >
                    <h4 className="mb-1">{course.title}</h4>
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                      {course.description}
                    </p>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{course.teacher}</span>
                      <Badge variant="secondary">
                        {studentAssignments.filter(a => a.courseId === course.id).length} assignments
                      </Badge>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}





