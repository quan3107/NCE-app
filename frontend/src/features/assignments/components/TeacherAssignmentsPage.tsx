/**
 * Location: features/assignments/components/TeacherAssignmentsPage.tsx
 * Purpose: Render the Teacher Assignments Page component for the Assignments domain.
 * Why: Keeps the feature module organized under the new structure.
 */

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@components/ui/card';
import { Button } from '@components/ui/button';
import { Badge } from '@components/ui/badge';
import { Label } from '@components/ui/label';
import { Input } from '@components/ui/input';
import { Textarea } from '@components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@components/ui/dialog';
import { PageHeader } from '@components/common/PageHeader';
import { useRouter } from '@lib/router';
import { formatDate } from '@lib/utils';
import { toast } from 'sonner@2.0.3';
import { Plus, Clock, FileText, Edit } from 'lucide-react';
import { useAssignmentResources, useCreateAssignmentMutation } from '@features/assignments/api';

export function TeacherAssignmentsPage() {
  const { navigate } = useRouter();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const { assignments, submissions, courses, isLoading, error } = useAssignmentResources();
  const createAssignmentMutation = useCreateAssignmentMutation();
  const [formState, setFormState] = useState({
    title: '',
    courseId: '',
    type: '',
    description: '',
    dueAt: '',
    maxScore: '100',
  });

  useEffect(() => {
    if (!formState.courseId && courses.length > 0) {
      setFormState((current) => ({ ...current, courseId: courses[0].id }));
    }
  }, [courses, formState.courseId]);

  const resetForm = () => {
    setFormState({
      title: '',
      courseId: courses[0]?.id ?? '',
      type: '',
      description: '',
      dueAt: '',
      maxScore: '100',
    });
  };

  const handleCreateAssignment = async (publish: boolean) => {
    if (!formState.title.trim()) {
      toast.error('Assignment title is required.');
      return;
    }
    if (!formState.courseId) {
      toast.error('Please select a course.');
      return;
    }
    if (!formState.type) {
      toast.error('Please select an assignment type.');
      return;
    }

    const payload = {
      title: formState.title.trim(),
      descriptionMd: formState.description.trim() || undefined,
      type: formState.type as 'file' | 'link' | 'text' | 'quiz',
      dueAt: formState.dueAt ? new Date(formState.dueAt).toISOString() : undefined,
      publishedAt: publish ? new Date().toISOString() : undefined,
    };

    try {
      await createAssignmentMutation.mutateAsync({
        courseId: formState.courseId,
        payload,
      });
      toast.success(publish ? 'Assignment published!' : 'Assignment saved as draft.');
      setShowCreateDialog(false);
      resetForm();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to create assignment.');
    }
  };

  const renderBody = () => {
    if (isLoading) {
      return (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Loading assignments...
          </CardContent>
        </Card>
      );
    }

    if (error) {
      return (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-destructive font-medium">Unable to load assignments.</p>
            <p className="text-sm text-muted-foreground mt-2">{error.message}</p>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-3">
        {assignments.map(assignment => (
          <Card
            key={assignment.id}
            className="hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => navigate(`/teacher/assignments/${assignment.id}/edit`)}
          >
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
                      <span>{submissions.filter(s => s.assignmentId === assignment.id).length} submissions</span>
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(event) => {
                    event.stopPropagation();
                    navigate(`/teacher/assignments/${assignment.id}/edit`);
                  }}
                >
                  <Edit className="size-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

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
        {renderBody()}
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
              <Input
                placeholder="Assignment title"
                value={formState.title}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, title: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Course</Label>
              <Select
                value={formState.courseId}
                onValueChange={(value) =>
                  setFormState((current) => ({ ...current, courseId: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select course" />
                </SelectTrigger>
                <SelectContent>
                  {courses.map(course => (
                    <SelectItem key={course.id} value={course.id}>{course.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={formState.type}
                onValueChange={(value) =>
                  setFormState((current) => ({ ...current, type: value }))
                }
              >
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
              <Textarea
                rows={5}
                placeholder="Assignment instructions..."
                value={formState.description}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, description: event.target.value }))
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Due Date</Label>
                <Input
                  type="datetime-local"
                  value={formState.dueAt}
                  onChange={(event) =>
                    setFormState((current) => ({ ...current, dueAt: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Max Score</Label>
                <Input
                  type="number"
                  placeholder="100"
                  value={formState.maxScore}
                  onChange={(event) =>
                    setFormState((current) => ({ ...current, maxScore: event.target.value }))
                  }
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateDialog(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              variant="secondary"
              onClick={() => handleCreateAssignment(false)}
              disabled={createAssignmentMutation.isLoading}
            >
              Save Draft
            </Button>
            <Button
              onClick={() => handleCreateAssignment(true)}
              disabled={createAssignmentMutation.isLoading}
            >
              {createAssignmentMutation.isLoading ? 'Saving...' : 'Create & Publish'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

