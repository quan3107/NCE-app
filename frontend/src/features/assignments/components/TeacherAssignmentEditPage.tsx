/**
 * Location: features/assignments/components/TeacherAssignmentEditPage.tsx
 * Purpose: Provide an edit view for teacher assignment updates and publishing.
 * Why: Enables the new assignment update endpoint to power the edit route.
 */

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@components/ui/card';
import { Button } from '@components/ui/button';
import { Label } from '@components/ui/label';
import { Input } from '@components/ui/input';
import { Textarea } from '@components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@components/ui/select';
import { PageHeader } from '@components/common/PageHeader';
import { toast } from 'sonner@2.0.3';

import { useRouter } from '@lib/router';
import { useAssignmentResources, useUpdateAssignmentMutation } from '@features/assignments/api';

type AssignmentFormState = {
  title: string;
  description: string;
  type: string;
  dueAt: string;
};

const emptyForm: AssignmentFormState = {
  title: '',
  description: '',
  type: '',
  dueAt: '',
};

export function TeacherAssignmentEditPage({ assignmentId }: { assignmentId: string }) {
  const { navigate } = useRouter();
  const { assignments, courses, isLoading, error } = useAssignmentResources();
  const updateAssignmentMutation = useUpdateAssignmentMutation();
  const assignment = useMemo(
    () => assignments.find((item) => item.id === assignmentId) ?? null,
    [assignments, assignmentId],
  );
  const course = useMemo(
    () => courses.find((item) => item.id === assignment?.courseId),
    [courses, assignment?.courseId],
  );

  const [formState, setFormState] = useState<AssignmentFormState>(emptyForm);

  useEffect(() => {
    if (!assignment) {
      return;
    }
    setFormState({
      title: assignment.title,
      description: assignment.description ?? '',
      type: assignment.type,
      dueAt: assignment.dueAt ? new Date(assignment.dueAt).toISOString().slice(0, 16) : '',
    });
  }, [assignment]);

  const handleSave = async (publish: boolean) => {
    if (!assignment) {
      return;
    }
    if (!formState.title.trim()) {
      toast.error('Assignment title is required.');
      return;
    }
    if (!formState.type) {
      toast.error('Assignment type is required.');
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
      await updateAssignmentMutation.mutateAsync({
        courseId: assignment.courseId,
        assignmentId: assignment.id,
        payload,
      });
      toast.success(publish ? 'Assignment published.' : 'Assignment updated.');
      navigate('/teacher/assignments');
    } catch (errorValue) {
      toast.error(
        errorValue instanceof Error ? errorValue.message : 'Unable to update assignment.',
      );
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Loading assignment...
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <Card>
          <CardContent className="py-12 text-center text-destructive">
            Unable to load assignment.
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Assignment not found.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Edit Assignment"
        description={assignment.courseName}
        showBack
      />
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-3xl space-y-6">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  value={formState.title}
                  onChange={(event) =>
                    setFormState((current) => ({ ...current, title: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Course</Label>
                <Input value={course?.title ?? assignment.courseName} disabled />
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
                  value={formState.description}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                />
              </div>
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
            </CardContent>
          </Card>

          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={() => navigate('/teacher/assignments')}
            >
              Cancel
            </Button>
            <Button
              variant="secondary"
              onClick={() => handleSave(false)}
              disabled={updateAssignmentMutation.isLoading}
            >
              Save Changes
            </Button>
            {assignment.status !== 'published' && (
              <Button
                onClick={() => handleSave(true)}
                disabled={updateAssignmentMutation.isLoading}
              >
                {updateAssignmentMutation.isLoading ? 'Publishing...' : 'Publish Now'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
