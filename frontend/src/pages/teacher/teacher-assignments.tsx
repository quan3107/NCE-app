import { useState } from 'react';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Label } from '../../components/ui/label';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { PageHeader } from '../../components/page-header';
import { useRouter } from '../../lib/router';
import { mockAssignments, mockCourses, mockSubmissions } from '../../lib/mock-data';
import { formatDate } from '../../lib/utils';
import { toast } from 'sonner@2.0.3';
import { Plus, Clock, FileText, Edit } from 'lucide-react';

export function TeacherAssignments() {
  const { navigate } = useRouter();
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  return (
    <div>
      <PageHeader
        title="Assignments"
        description="Manage assignments across all courses"
        actions={
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="mr-2 size-4" />
            Create Assignment
          </Button>
        }
      />
      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        <div className="space-y-3">
          {mockAssignments.map(assignment => (
            <Card key={assignment.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(`/teacher/assignments/${assignment.id}`)}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3>{assignment.title}</h3>
                      <Badge variant={assignment.status === 'published' ? 'default' : 'secondary'} className="capitalize">
                        {assignment.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">{assignment.courseName}</p>
                    <div className="flex flex-wrap gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <Clock className="size-4 text-muted-foreground" />
                        <span>Due: {formatDate(assignment.dueAt, 'datetime')}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <FileText className="size-4 text-muted-foreground" />
                        <span>{mockSubmissions.filter(s => s.assignmentId === assignment.id).length} submissions</span>
                      </div>
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
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Assignment</DialogTitle>
            <DialogDescription>Add a new assignment to your course</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input placeholder="Assignment title" />
            </div>
            <div className="space-y-2">
              <Label>Course</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Select course" />
                </SelectTrigger>
                <SelectContent>
                  {mockCourses.map(course => (
                    <SelectItem key={course.id} value={course.id}>{course.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="file">File Upload</SelectItem>
                  <SelectItem value="text">Text Response</SelectItem>
                  <SelectItem value="link">Link Submission</SelectItem>
                  <SelectItem value="quiz">Quiz</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea rows={5} placeholder="Assignment instructions..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Due Date</Label>
                <Input type="datetime-local" />
              </div>
              <div className="space-y-2">
                <Label>Max Score</Label>
                <Input type="number" placeholder="100" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button onClick={() => { toast.success('Assignment created!'); setShowCreateDialog(false); }}>
              Create & Publish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

