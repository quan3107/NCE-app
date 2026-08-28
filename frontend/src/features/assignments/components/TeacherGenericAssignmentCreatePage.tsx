/**
 * Location: features/assignments/components/TeacherGenericAssignmentCreatePage.tsx
 * Purpose: Author and publish supported generic assignments.
 * Why: The active teacher create route previously exposed only IELTS workflows.
 */
import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner@2.0.3';

import { Button } from '@components/ui/button';
import { Card, CardContent } from '@components/ui/card';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { PageHeader } from '@components/common/PageHeader';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@components/ui/select';
import { Textarea } from '@components/ui/textarea';
import type { Course } from '@domain';
import { useCreateAssignmentMutation } from '@features/assignments/api';
import type { GenericAssignmentType } from './GenericAssignmentTypeSelection';

type TeacherGenericAssignmentCreatePageProps = {
  courses: Course[];
  initialType: GenericAssignmentType;
  onCancel: () => void;
  onCreated: () => void;
};

const typeLabels: Record<GenericAssignmentType, string> = {
  file: 'File Upload',
  link: 'Link Response',
  text: 'Text Response',
};

export function TeacherGenericAssignmentCreatePage({
  courses,
  initialType,
  onCancel,
  onCreated,
}: TeacherGenericAssignmentCreatePageProps) {
  const createAssignmentMutation = useCreateAssignmentMutation();
  const [title, setTitle] = useState('');
  const [courseId, setCourseId] = useState('');
  const [type, setType] = useState<GenericAssignmentType>(initialType);
  const [description, setDescription] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [maxScore, setMaxScore] = useState('100');

  const handleSubmit = async (publish: boolean) => {
    if (!title.trim()) {
      toast.error('Assignment title is required.');
      return;
    }
    if (!courseId) {
      toast.error('Please select a course.');
      return;
    }
    if (publish && !dueAt) {
      toast.error('Due date is required before publishing.');
      return;
    }

    const parsedScore = Number(maxScore);
    if (!Number.isFinite(parsedScore) || parsedScore <= 0 || parsedScore > 10_000) {
      toast.error('Maximum score must be greater than 0 and no more than 10,000.');
      return;
    }

    const parsedDueAt = dueAt ? new Date(dueAt) : null;
    if (parsedDueAt && Number.isNaN(parsedDueAt.getTime())) {
      toast.error('Enter a valid due date.');
      return;
    }

    try {
      await createAssignmentMutation.mutateAsync({
        courseId,
        payload: {
          title: title.trim(),
          descriptionMd: description.trim() || undefined,
          type,
          dueAt: parsedDueAt?.toISOString(),
          assignmentConfig: {
            version: 1,
            maxScore: parsedScore,
          },
          publishedAt: publish ? new Date().toISOString() : undefined,
        },
      });
      toast.success(publish ? 'Assignment published successfully.' : 'Assignment draft saved.');
      onCreated();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to save assignment.');
    }
  };

  return (
    <div>
      <PageHeader
        title={`Create ${typeLabels[type]} Assignment`}
        description="Configure the student response and grading details"
        actions={
          <Button variant="outline" onClick={onCancel}>
            <ArrowLeft className="mr-2 size-4" />
            Change Type
          </Button>
        }
      />
      <div className="p-4 sm:p-6 lg:p-8">
        <Card className="mx-auto max-w-4xl">
          <CardContent className="space-y-6 p-6">
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="generic-assignment-title">Title</Label>
                <Input
                  id="generic-assignment-title"
                  value={title}
                  maxLength={200}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="generic-assignment-course">Course</Label>
                <Select value={courseId} onValueChange={setCourseId}>
                  <SelectTrigger id="generic-assignment-course">
                    <SelectValue placeholder="Select course" />
                  </SelectTrigger>
                  <SelectContent>
                    {courses.map((course) => (
                      <SelectItem key={course.id} value={course.id}>
                        {course.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="generic-assignment-type">Response Type</Label>
              <Select value={type} onValueChange={(value) => setType(value as GenericAssignmentType)}>
                <SelectTrigger id="generic-assignment-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text Response</SelectItem>
                  <SelectItem value="link">Link Response</SelectItem>
                  <SelectItem value="file">File Upload</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="generic-assignment-description">Description</Label>
              <Textarea
                id="generic-assignment-description"
                rows={6}
                maxLength={100_000}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="generic-assignment-due">Due Date</Label>
                <Input
                  id="generic-assignment-due"
                  type="datetime-local"
                  value={dueAt}
                  onChange={(event) => setDueAt(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="generic-assignment-score">Maximum Score</Label>
                <Input
                  id="generic-assignment-score"
                  type="number"
                  min="0.01"
                  max="10000"
                  step="0.01"
                  value={maxScore}
                  onChange={(event) => setMaxScore(event.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-3 border-t pt-5">
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button
                variant="secondary"
                disabled={createAssignmentMutation.isPending}
                onClick={() => void handleSubmit(false)}
              >
                Save Draft
              </Button>
              <Button disabled={createAssignmentMutation.isPending} onClick={() => void handleSubmit(true)}>
                {createAssignmentMutation.isPending ? 'Publishing...' : 'Create & Publish'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
