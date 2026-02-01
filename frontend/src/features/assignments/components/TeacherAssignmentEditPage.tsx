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
import type { Assignment } from '@lib/mock-data';
import { cn } from '@components/ui/utils';
import {
  createIeltsAssignmentConfig,
  isIeltsAssignmentType,
  normalizeIeltsAssignmentConfig,
  type IeltsAssignmentConfig,
  type IeltsAssignmentType,
} from '@lib/ielts';
import { useAssignmentResources, useUpdateAssignmentMutation } from '@features/assignments/api';
import { IeltsAssignmentBuilder } from './ielts/IeltsAssignmentBuilder';
import { IeltsTypeCards } from './ielts/IeltsTypeCards';

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
  const [assignmentConfig, setAssignmentConfig] = useState<IeltsAssignmentConfig | null>(
    null,
  );
  const isIelts = isIeltsAssignmentType(formState.type);

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
    if (isIeltsAssignmentType(assignment.type)) {
      setAssignmentConfig(
        normalizeIeltsAssignmentConfig(assignment.type, assignment.assignmentConfig),
      );
    } else {
      setAssignmentConfig(null);
    }
  }, [assignment]);

  const handleTypeChange = (value: string) => {
    setFormState((current) => ({ ...current, type: value }));
    if (isIeltsAssignmentType(value)) {
      setAssignmentConfig(createIeltsAssignmentConfig(value));
    } else {
      setAssignmentConfig(null);
    }
  };

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
    if (isIeltsAssignmentType(formState.type) && !assignmentConfig) {
      toast.error('IELTS assignments require a full configuration.');
      return;
    }

    const payload = {
      title: formState.title.trim(),
      descriptionMd: formState.description.trim() || undefined,
      type: formState.type as Assignment['type'],
      dueAt: formState.dueAt ? new Date(formState.dueAt).toISOString() : undefined,
      assignmentConfig:
        isIeltsAssignmentType(formState.type) && assignmentConfig
          ? assignmentConfig
          : undefined,
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
        <div className={cn('max-w-5xl space-y-6', isIelts && 'ielts-authoring')}>
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
                <Label>IELTS Skill Type</Label>
                <IeltsTypeCards
                  value={
                    isIeltsAssignmentType(formState.type)
                      ? (formState.type as IeltsAssignmentType)
                      : null
                  }
                  onChange={(value) => handleTypeChange(value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Other Assignment Types</Label>
                <Select
                  value={isIeltsAssignmentType(formState.type) ? '' : formState.type}
                  onValueChange={handleTypeChange}
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
                <Label>{isIelts ? 'Overview (shown in assignment list)' : 'Description'}</Label>
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
                {isIelts && (
                  <p className="text-xs text-muted-foreground">
                    Student-facing instructions live inside the IELTS builder below.
                  </p>
                )}
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
          {isIeltsAssignmentType(formState.type) && assignmentConfig && (
            <IeltsAssignmentBuilder
              type={formState.type as IeltsAssignmentType}
              value={assignmentConfig}
              onChange={setAssignmentConfig}
              onTypeChange={(nextType, nextConfig) => {
                setFormState((current) => ({ ...current, type: nextType }));
                setAssignmentConfig(nextConfig);
              }}
              showTypeSelector={false}
            />
          )}

          <div
            className={cn(
              'flex flex-wrap gap-3',
              isIelts &&
                'sticky bottom-4 z-10 rounded-lg border bg-background/95 p-4 shadow-sm backdrop-blur',
            )}
          >
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
