import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { PageHeader } from '../../components/page-header';
import { useRouter } from '../../lib/router';
import { mockAssignments, mockCourses, mockSubmissions } from '../../lib/mock-data';
import { formatDistanceToNow } from '../../lib/utils';
import { FileText, Clock, Users, TrendingUp } from 'lucide-react';

export function TeacherDashboard() {
  const { navigate } = useRouter();

  const openSubmissions = mockSubmissions.filter(s => s.status === 'submitted' || s.status === 'late').length;
  const avgTurnaround = 2.5;

  const stats = [
    { label: 'Active Assignments', value: mockAssignments.filter(a => a.status === 'published').length, icon: <FileText className="size-5" /> },
    { label: 'Pending Grading', value: openSubmissions, icon: <Clock className="size-5 text-orange-500" /> },
    { label: 'Total Students', value: 42, icon: <Users className="size-5 text-blue-500" /> },
    { label: 'Avg Turnaround', value: `${avgTurnaround} days`, icon: <TrendingUp className="size-5 text-green-500" /> },
  ];

  return (
    <div>
      <PageHeader title="Dashboard" description="Welcome back! Here's your overview." />
      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
                {mockSubmissions.filter(s => s.status === 'submitted' || s.status === 'late').slice(0, 3).map(submission => {
                  const assignment = mockAssignments.find(a => a.id === submission.assignmentId);
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
                {mockCourses.map(course => (
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
