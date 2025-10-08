import { useState } from 'react';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { PageHeader } from '../components/page-header';
import { useRouter } from '../lib/router';
import { useAuth } from '../lib/auth-context';
import { mockAssignments, mockSubmissions, mockEnrollments, mockCourses, SubmissionStatus } from '../lib/mock-data';
import { Search, FileText, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { formatDistanceToNow, formatDate } from '../lib/utils';

export function StudentAssignments() {
  const { navigate } = useRouter();
  const { currentUser } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCourse, setFilterCourse] = useState('all');
  const [activeTab, setActiveTab] = useState('all');

  if (!currentUser) return null;

  // Get student's enrolled courses
  const enrolledCourseIds = mockEnrollments
    .filter(e => e.userId === currentUser.id)
    .map(e => e.courseId);

  const studentCourses = mockCourses.filter(c => enrolledCourseIds.includes(c.id));

  // Get assignments for enrolled courses
  const studentAssignments = mockAssignments.filter(a =>
    enrolledCourseIds.includes(a.courseId) && a.status === 'published'
  );

  const studentSubmissions = mockSubmissions.filter(s => s.studentId === currentUser.id);

  // Filter and categorize assignments
  const getAssignmentStatus = (assignmentId: string): SubmissionStatus => {
    const submission = studentSubmissions.find(s => s.assignmentId === assignmentId);
    return submission?.status || 'not_submitted';
  };

  const filteredAssignments = studentAssignments.filter(assignment => {
    const matchesSearch = assignment.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCourse = filterCourse === 'all' || assignment.courseId === filterCourse;
    const status = getAssignmentStatus(assignment.id);

    let matchesTab = true;
    if (activeTab === 'todo') {
      matchesTab = status === 'not_submitted' && new Date(assignment.dueAt) > new Date();
    } else if (activeTab === 'submitted') {
      matchesTab = status === 'submitted' || status === 'late';
    } else if (activeTab === 'graded') {
      matchesTab = status === 'graded';
    }

    return matchesSearch && matchesCourse && matchesTab;
  });

  const counts = {
    all: studentAssignments.length,
    todo: studentAssignments.filter(a => getAssignmentStatus(a.id) === 'not_submitted' && new Date(a.dueAt) > new Date()).length,
    submitted: studentAssignments.filter(a => ['submitted', 'late'].includes(getAssignmentStatus(a.id))).length,
    graded: studentAssignments.filter(a => getAssignmentStatus(a.id) === 'graded').length,
  };

  return (
    <div>
      <PageHeader
        title="Assignments"
        description="View and manage your assignments across all courses"
      />

      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder="Search assignments..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={filterCourse} onValueChange={setFilterCourse}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="All Courses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Courses</SelectItem>
                  {studentCourses.map(course => (
                    <SelectItem key={course.id} value={course.id}>
                      {course.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="all">
              All <Badge variant="secondary" className="ml-2">{counts.all}</Badge>
            </TabsTrigger>
            <TabsTrigger value="todo">
              To Do <Badge variant="secondary" className="ml-2">{counts.todo}</Badge>
            </TabsTrigger>
            <TabsTrigger value="submitted">
              Submitted <Badge variant="secondary" className="ml-2">{counts.submitted}</Badge>
            </TabsTrigger>
            <TabsTrigger value="graded">
              Graded <Badge variant="secondary" className="ml-2">{counts.graded}</Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-6">
            {filteredAssignments.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <FileText className="size-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="mb-2">No assignments found</h3>
                  <p className="text-muted-foreground">
                    {searchQuery || filterCourse !== 'all'
                      ? 'Try adjusting your filters'
                      : 'You\'re all caught up!'}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredAssignments.map(assignment => {
                  const status = getAssignmentStatus(assignment.id);
                  const submission = studentSubmissions.find(s => s.assignmentId === assignment.id);
                  const dueDate = new Date(assignment.dueAt);
                  const now = new Date();
                  const isOverdue = dueDate < now && status === 'not_submitted';
                  const hoursUntilDue = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60);
                  const isDueSoon = hoursUntilDue <= 48 && hoursUntilDue > 0;

                  return (
                    <Card
                      key={assignment.id}
                      className="hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => navigate(`/student/assignments/${assignment.id}`)}
                    >
                      <CardContent className="p-6">
                        <div className="flex items-start gap-4">
                          <div className="flex-1 min-w-0 space-y-3">
                            <div>
                              <div className="flex items-start gap-3 mb-2">
                                <h3 className="flex-1">{assignment.title}</h3>
                                {status === 'graded' ? (
                                  <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-200">
                                    <CheckCircle2 className="size-3 mr-1" />
                                    Graded
                                  </Badge>
                                ) : status === 'submitted' ? (
                                  <Badge variant="outline" className="bg-blue-500/10 text-blue-700 border-blue-200">
                                    <FileText className="size-3 mr-1" />
                                    Submitted
                                  </Badge>
                                ) : status === 'late' ? (
                                  <Badge variant="destructive">
                                    <AlertCircle className="size-3 mr-1" />
                                    Late
                                  </Badge>
                                ) : isOverdue ? (
                                  <Badge variant="destructive">
                                    <AlertCircle className="size-3 mr-1" />
                                    Overdue
                                  </Badge>
                                ) : isDueSoon ? (
                                  <Badge variant="outline" className="bg-orange-500/10 text-orange-700 border-orange-200">
                                    <Clock className="size-3 mr-1" />
                                    Due Soon
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary">Assigned</Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">{assignment.courseName}</p>
                            </div>

                            <div className="flex flex-wrap gap-4 text-sm">
                              <div className="flex items-center gap-2">
                                <Clock className="size-4 text-muted-foreground" />
                                <span className="text-muted-foreground">Due:</span>
                                <span className={isOverdue ? 'text-red-600 font-medium' : ''}>
                                  {formatDate(dueDate, 'datetime')}
                                </span>
                                {!isOverdue && dueDate > now && (
                                  <span className="text-muted-foreground">
                                    ({formatDistanceToNow(dueDate, { addSuffix: true })})
                                  </span>
                                )}
                              </div>
                              {submission?.submittedAt && (
                                <div className="flex items-center gap-2">
                                  <CheckCircle2 className="size-4 text-green-500" />
                                  <span className="text-muted-foreground">Submitted:</span>
                                  <span>{formatDate(new Date(submission.submittedAt), 'datetime')}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          <Button variant="ghost" size="sm">
                            View
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
