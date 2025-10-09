/**
 * Location: features/courses/management/TeacherCourseManagement.tsx
 * Purpose: Render the teacher course management workspace with tabbed controls.
 * Why: Provides a consolidated UI so teachers can manage courses without backend data.
 */

import { useState } from 'react';
import { PageHeader } from '@components/common/PageHeader';
import { Alert, AlertDescription } from '@components/ui/alert';
import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@components/ui/dialog';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@components/ui/select';
import { Switch } from '@components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@components/ui/tabs';
import { Textarea } from '@components/ui/textarea';
import { useRouter } from '@lib/router';
import { formatDate } from '@lib/utils';
import { mockAssignments, mockCourses, mockEnrollments, mockUsers } from '@lib/mock-data';
import { 
  ArrowLeft, 
  Save, 
  Plus, 
  Trash2, 
  Edit, 
  Send, 
  Calendar, 
  Clock, 
  Users, 
  Megaphone, 
  Settings, 
  BookOpen,
  CheckCircle2,
  X,
  UserPlus,
  Mail
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';

export function TeacherCourseManagement({ courseId }: { courseId: string }) {
  const { navigate } = useRouter();
  const [activeTab, setActiveTab] = useState('overview');
  const [showAddStudentDialog, setShowAddStudentDialog] = useState(false);
  const [showCreateAnnouncementDialog, setShowCreateAnnouncementDialog] = useState(false);
  const [showEditRubricDialog, setShowEditRubricDialog] = useState(false);

  // Course state
  const course = mockCourses.find(c => c.id === courseId);
  const [courseTitle, setCourseTitle] = useState(course?.title || '');
  const [courseDescription, setCourseDescription] = useState(course?.description || '');
  const [courseSchedule, setCourseSchedule] = useState(course?.schedule || '');
  const [courseDuration, setCourseDuration] = useState(course?.duration || '');
  const [courseLevel, setCourseLevel] = useState(course?.level || '');
  const [coursePrice, setCoursePrice] = useState(course?.price?.toString() || '');

  // Student enrollment state
  const [newStudentEmail, setNewStudentEmail] = useState('');
  const enrolledStudents = mockEnrollments
    .filter(e => e.courseId === courseId)
    .map(e => mockUsers.find(u => u.id === e.userId))
    .filter(Boolean);

  // Assignment/deadline state
  const courseAssignments = mockAssignments.filter(a => a.courseId === courseId);

  // Announcement state
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementMessage, setAnnouncementMessage] = useState('');
  const [sendEmail, setSendEmail] = useState(true);

  // Rubric state
  const [rubricCriteria, setRubricCriteria] = useState([
    { name: 'Task Achievement', weight: 25, description: 'How well the task requirements are met' },
    { name: 'Coherence & Cohesion', weight: 25, description: 'Logical organization and flow' },
    { name: 'Lexical Resource', weight: 25, description: 'Vocabulary range and accuracy' },
    { name: 'Grammatical Range', weight: 25, description: 'Grammar variety and accuracy' },
  ]);

  if (!course) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Course not found</p>
          <Button onClick={() => navigate('/teacher/courses')}>
            <ArrowLeft className="mr-2 size-4" />
            Back to Courses
          </Button>
        </div>
      </div>
    );
  }

  const handleSaveCourseDetails = () => {
    toast.success('Course details updated successfully');
  };

  const handleAddStudent = () => {
    if (!newStudentEmail) {
      toast.error('Please enter a student email');
      return;
    }
    toast.success(`Invitation sent to ${newStudentEmail}`);
    setNewStudentEmail('');
    setShowAddStudentDialog(false);
  };

  const handleRemoveStudent = (studentId: string, studentName: string) => {
    toast.success(`${studentName} removed from course`);
  };

  const handleCreateAnnouncement = () => {
    if (!announcementTitle || !announcementMessage) {
      toast.error('Please fill in all fields');
      return;
    }
    toast.success(`Announcement posted${sendEmail ? ' and sent via email' : ''}`);
    setAnnouncementTitle('');
    setAnnouncementMessage('');
    setShowCreateAnnouncementDialog(false);
  };

  const handleSaveRubric = () => {
    const totalWeight = rubricCriteria.reduce((sum, c) => sum + c.weight, 0);
    if (totalWeight !== 100) {
      toast.error('Rubric criteria weights must total 100%');
      return;
    }
    toast.success('Rubric updated successfully');
    setShowEditRubricDialog(false);
  };

  return (
    <div>
      <PageHeader
        title={course.title}
        description="Manage all aspects of this course"
        actions={
          <Button variant="outline" onClick={() => navigate('/teacher/courses')}>
            <ArrowLeft className="mr-2 size-4" />
            Back to Courses
          </Button>
        }
      />

      <div className="p-4 sm:p-6 lg:p-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6 !flex w-full flex-wrap gap-2 md:flex-nowrap">
            <TabsTrigger value="overview">
              <BookOpen className="mr-2 size-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="students">
              <Users className="mr-2 size-4" />
              Students
            </TabsTrigger>
            <TabsTrigger value="deadlines">
              <Clock className="mr-2 size-4" />
              Deadlines
            </TabsTrigger>
            <TabsTrigger value="announcements">
              <Megaphone className="mr-2 size-4" />
              Announcements
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="mr-2 size-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          {/* OVERVIEW TAB */}
          <TabsContent value="overview" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Course Details</CardTitle>
                <CardDescription>Update basic course information and schedule</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Course Title</Label>
                    <Input 
                      value={courseTitle} 
                      onChange={(e) => setCourseTitle(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Level</Label>
                    <Select value={courseLevel} onValueChange={setCourseLevel}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Beginner">Beginner</SelectItem>
                        <SelectItem value="Intermediate">Intermediate</SelectItem>
                        <SelectItem value="Advanced">Advanced</SelectItem>
                        <SelectItem value="All Levels">All Levels</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea 
                    value={courseDescription}
                    onChange={(e) => setCourseDescription(e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Schedule</Label>
                    <Input 
                      value={courseSchedule}
                      onChange={(e) => setCourseSchedule(e.target.value)}
                      placeholder="e.g., Mon & Wed, 6-8 PM"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Duration</Label>
                    <Input 
                      value={courseDuration}
                      onChange={(e) => setCourseDuration(e.target.value)}
                      placeholder="e.g., 8 weeks"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Price ($)</Label>
                    <Input 
                      type="number"
                      value={coursePrice}
                      onChange={(e) => setCoursePrice(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleSaveCourseDetails}>
                    <Save className="mr-2 size-4" />
                    Save Changes
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Course Statistics */}
            <Card>
              <CardHeader>
                <CardTitle>Course Statistics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-lg border">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="size-5 text-blue-500" />
                      <span className="text-sm text-muted-foreground">Total Students</span>
                    </div>
                    <p className="text-2xl">{enrolledStudents.length}</p>
                  </div>
                  <div className="p-4 rounded-lg border">
                    <div className="flex items-center gap-2 mb-2">
                      <BookOpen className="size-5 text-green-500" />
                      <span className="text-sm text-muted-foreground">Assignments</span>
                    </div>
                    <p className="text-2xl">{courseAssignments.length}</p>
                  </div>
                  <div className="p-4 rounded-lg border">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 className="size-5 text-purple-500" />
                      <span className="text-sm text-muted-foreground">Completion Rate</span>
                    </div>
                    <p className="text-2xl">78%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* STUDENTS TAB */}
          <TabsContent value="students" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Enrolled Students</CardTitle>
                    <CardDescription>Manage student enrollment and access</CardDescription>
                  </div>
                  <Button onClick={() => setShowAddStudentDialog(true)}>
                    <UserPlus className="mr-2 size-4" />
                    Add Student
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {enrolledStudents.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="size-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground mb-4">No students enrolled yet</p>
                    <Button onClick={() => setShowAddStudentDialog(true)}>
                      Add First Student
                    </Button>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Enrolled</TableHead>
                        <TableHead>Progress</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {enrolledStudents.map((student: any) => (
                        <TableRow key={student.id}>
                          <TableCell>{student.name}</TableCell>
                          <TableCell>{student.email}</TableCell>
                          <TableCell>{formatDate(new Date(), 'date')}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">Active</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleRemoveStudent(student.id, student.name)}
                            >
                              <Trash2 className="size-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* DEADLINES TAB */}
          <TabsContent value="deadlines" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Assignment Deadlines</CardTitle>
                    <CardDescription>Manage assignment due dates and extensions</CardDescription>
                  </div>
                  <Button onClick={() => navigate('/teacher/assignments')}>
                    <Plus className="mr-2 size-4" />
                    Create Assignment
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {courseAssignments.length === 0 ? (
                  <div className="text-center py-12">
                    <Clock className="size-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground mb-4">No assignments created yet</p>
                    <Button onClick={() => navigate('/teacher/assignments')}>
                      Create First Assignment
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {courseAssignments.map((assignment) => (
                      <Card key={assignment.id} className="border-l-4 border-l-blue-500">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h4 className="mb-1">{assignment.title}</h4>
                              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                <div className="flex items-center gap-1">
                                  <Calendar className="size-4" />
                                  <span>Due: {formatDate(assignment.dueAt, 'datetime')}</span>
                                </div>
                                <Badge variant={assignment.status === 'published' ? 'default' : 'secondary'}>
                                  {assignment.status}
                                </Badge>
                              </div>
                            </div>
                            <Button variant="ghost" size="sm">
                              <Edit className="size-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ANNOUNCEMENTS TAB */}
          <TabsContent value="announcements" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Course Announcements</CardTitle>
                    <CardDescription>Communicate important updates to all students</CardDescription>
                  </div>
                  <Button onClick={() => setShowCreateAnnouncementDialog(true)}>
                    <Plus className="mr-2 size-4" />
                    New Announcement
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Alert>
                    <Megaphone className="size-4" />
                    <AlertDescription>
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium mb-1">Welcome to the course!</p>
                          <p className="text-sm text-muted-foreground">
                            Please review the syllabus and complete the first assignment by Friday.
                          </p>
                          <p className="text-xs text-muted-foreground mt-2">Posted 3 days ago</p>
                        </div>
                        <Button variant="ghost" size="sm">
                          <Edit className="size-4" />
                        </Button>
                      </div>
                    </AlertDescription>
                  </Alert>

                  <Alert>
                    <Megaphone className="size-4" />
                    <AlertDescription>
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium mb-1">Office Hours This Week</p>
                          <p className="text-sm text-muted-foreground">
                            I'll be available for office hours on Thursday from 2-4 PM. Book a slot in advance.
                          </p>
                          <p className="text-xs text-muted-foreground mt-2">Posted 1 week ago</p>
                        </div>
                        <Button variant="ghost" size="sm">
                          <Edit className="size-4" />
                        </Button>
                      </div>
                    </AlertDescription>
                  </Alert>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* SETTINGS TAB */}
          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Grading Rubric</CardTitle>
                <CardDescription>Configure the default rubric for this course</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  {rubricCriteria.map((criterion, index) => (
                    <div key={index} className="flex items-center gap-4 p-3 rounded-lg border">
                      <div className="flex-1">
                        <p className="font-medium">{criterion.name}</p>
                        <p className="text-sm text-muted-foreground">{criterion.description}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input 
                          type="number" 
                          value={criterion.weight} 
                          onChange={(e) => {
                            const newCriteria = [...rubricCriteria];
                            newCriteria[index].weight = parseInt(e.target.value) || 0;
                            setRubricCriteria(newCriteria);
                          }}
                          className="w-20 text-center"
                        />
                        <span className="text-sm text-muted-foreground">%</span>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="flex items-center justify-between pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Total: {rubricCriteria.reduce((sum, c) => sum + c.weight, 0)}%
                  </p>
                  <Button onClick={() => setShowEditRubricDialog(true)}>
                    <Edit className="mr-2 size-4" />
                    Edit Rubric
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Course Visibility</CardTitle>
                <CardDescription>Control who can see and enroll in this course</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Published</p>
                    <p className="text-sm text-muted-foreground">Make this course visible to students</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Allow Self-Enrollment</p>
                    <p className="text-sm text-muted-foreground">Students can enroll without invitation</p>
                  </div>
                  <Switch />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Email Notifications</p>
                    <p className="text-sm text-muted-foreground">Send automatic updates to students</p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </CardContent>
            </Card>

            <Card className="border-destructive/50">
              <CardHeader>
                <CardTitle className="text-destructive">Danger Zone</CardTitle>
                <CardDescription>Irreversible actions for this course</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Archive Course</p>
                    <p className="text-sm text-muted-foreground">Hide from active courses list</p>
                  </div>
                  <Button variant="outline">Archive</Button>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Delete Course</p>
                    <p className="text-sm text-muted-foreground">Permanently remove all data</p>
                  </div>
                  <Button variant="destructive">Delete</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Add Student Dialog */}
      <Dialog open={showAddStudentDialog} onOpenChange={setShowAddStudentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Student to Course</DialogTitle>
            <DialogDescription>
              Enter the student's email address to send them an invitation
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Student Email</Label>
              <Input
                type="email"
                placeholder="student@example.com"
                value={newStudentEmail}
                onChange={(e) => setNewStudentEmail(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddStudentDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddStudent}>
              <Mail className="mr-2 size-4" />
              Send Invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Announcement Dialog */}
      <Dialog open={showCreateAnnouncementDialog} onOpenChange={setShowCreateAnnouncementDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Announcement</DialogTitle>
            <DialogDescription>
              Send an announcement to all students in this course
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                placeholder="Announcement title"
                value={announcementTitle}
                onChange={(e) => setAnnouncementTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Message</Label>
              <Textarea
                placeholder="Your announcement message..."
                value={announcementMessage}
                onChange={(e) => setAnnouncementMessage(e.target.value)}
                rows={4}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={sendEmail}
                onCheckedChange={setSendEmail}
              />
              <Label>Also send via email</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateAnnouncementDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateAnnouncement}>
              <Send className="mr-2 size-4" />
              Post Announcement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
