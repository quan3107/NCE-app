/**
 * Location: src/routes/DashboardStudentPanels.tsx
 * Purpose: Render reusable panel sections for the student dashboard route.
 * Why: Keeps DashboardStudentRoute focused on orchestration while reducing file size and complexity.
 */

import { AlertCircle, CheckCircle2, Clock, FileText } from 'lucide-react';

import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@components/ui/card';
import type { Assignment, Course, Submission } from '@lib/mock-data';
import { formatDistanceToNow } from '@lib/utils';

type NavigateFn = (path: string) => void;

type StudentDueSoonPanelProps = {
  dueSoon: Assignment[];
  now: Date;
  navigate: NavigateFn;
};

export function StudentDueSoonPanel({ dueSoon, now, navigate }: StudentDueSoonPanelProps) {
  return (
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
            {dueSoon.slice(0, 3).map((assignment) => {
              const hoursUntilDue =
                (new Date(assignment.dueAt).getTime() - now.getTime()) / (1000 * 60 * 60);
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
  );
}

type StudentRecentActivityPanelProps = {
  studentSubmissions: Submission[];
  studentAssignments: Assignment[];
  navigate: NavigateFn;
};

export function StudentRecentActivityPanel({
  studentSubmissions,
  studentAssignments,
  navigate,
}: StudentRecentActivityPanelProps) {
  return (
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
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => navigate('/student/assignments')}
            >
              View Assignments
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {studentSubmissions.slice(0, 3).map((submission) => {
              const assignment = studentAssignments.find((item) => item.id === submission.assignmentId);
              if (!assignment) {
                return null;
              }

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
  );
}

type StudentEnrolledCoursesPanelProps = {
  courses: Course[];
  enrolledCourseIds: string[];
  studentAssignments: Assignment[];
  navigate: NavigateFn;
};

export function StudentEnrolledCoursesPanel({
  courses,
  enrolledCourseIds,
  studentAssignments,
  navigate,
}: StudentEnrolledCoursesPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>My Courses</CardTitle>
        <CardDescription>Courses you're currently enrolled in</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-3 gap-4">
          {courses
            .filter((course) => enrolledCourseIds.includes(course.id))
            .map((course) => (
              <div
                key={course.id}
                className="p-4 rounded-lg border hover:bg-accent/50 cursor-pointer transition-colors"
                onClick={() => navigate('/courses/' + course.id)}
              >
                <h4 className="mb-1">{course.title}</h4>
                <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{course.description}</p>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{course.teacher}</span>
                  <Badge variant="secondary">
                    {studentAssignments.filter((item) => item.courseId === course.id).length} assignments
                  </Badge>
                </div>
              </div>
            ))}
        </div>
      </CardContent>
    </Card>
  );
}
