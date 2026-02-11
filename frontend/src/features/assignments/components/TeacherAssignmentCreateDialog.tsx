/**
 * Location: features/assignments/components/TeacherAssignmentCreateDialog.tsx
 * Purpose: Render the assignment creation dialog with IELTS authoring support.
 * Why: Keeps the main list page small while supporting richer IELTS configs.
 */

import { useEffect, useMemo, useState } from 'react';

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@components/ui/dialog';
import { Button } from '@components/ui/button';
import { Card } from '@components/ui/card';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@components/ui/select';
import { Textarea } from '@components/ui/textarea';
import { toast } from 'sonner@2.0.3';

import type { Assignment, Course } from '@domain';
import {
  createIeltsAssignmentConfig,
  isIeltsAssignmentType,
  type IeltsAssignmentConfig,
  type IeltsAssignmentType,
} from '@lib/ielts';
import { useCreateAssignmentMutation } from '@features/assignments/api';
import { cn } from '@components/ui/utils';
import { IeltsAssignmentBuilder } from './ielts/IeltsAssignmentBuilder';
import { IeltsTypeCards } from './ielts/IeltsTypeCards';

type AssignmentFormState = {
  title: string;
  courseId: string;
  type: string;
  description: string;
  dueAt: string;
  maxScore: string;
};

const emptyForm: AssignmentFormState = {
  title: '',
  courseId: '',
  type: '',
  description: '',
  dueAt: '',
  maxScore: '100',
};

type TeacherAssignmentCreateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courses: Course[];
};

export function TeacherAssignmentCreateDialog({
  open,
  onOpenChange,
  courses,
}: TeacherAssignmentCreateDialogProps) {
  const createAssignmentMutation = useCreateAssignmentMutation();
  const [formState, setFormState] = useState<AssignmentFormState>(emptyForm);
  const [assignmentConfig, setAssignmentConfig] = useState<IeltsAssignmentConfig | null>(null);
  const selectedIeltsType = useMemo(
    () => (isIeltsAssignmentType(formState.type) ? formState.type : null),
    [formState.type],
  );
  const isIelts = Boolean(selectedIeltsType);

  useEffect(() => {
    if (!formState.courseId && courses.length > 0) {
      setFormState((current) => ({ ...current, courseId: courses[0].id }));
    }
  }, [courses, formState.courseId]);

  useEffect(() => {
    if (!open) {
      setFormState({
        ...emptyForm,
        courseId: courses[0]?.id ?? '',
      });
      setAssignmentConfig(null);
    }
  }, [open, courses]);

  const handleTypeChange = (value: string) => {
    setFormState((current) => ({ ...current, type: value }));
    if (isIeltsAssignmentType(value)) {
      setAssignmentConfig(createIeltsAssignmentConfig(value));
    } else {
      setAssignmentConfig(null);
    }
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
        isIeltsAssignmentType(formState.type) && assignmentConfig ? assignmentConfig : undefined,
      publishedAt: publish ? new Date().toISOString() : undefined,
    };

    try {
      await createAssignmentMutation.mutateAsync({
        courseId: formState.courseId,
        payload,
      });
      toast.success(publish ? 'Assignment published!' : 'Assignment saved as draft.');
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to create assignment.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-3">
          <DialogTitle className="text-2xl">Create Assignment</DialogTitle>
          <DialogDescription>Add a new assignment to your course</DialogDescription>
        </DialogHeader>
        <div className={cn('space-y-8 pt-2', isIelts && 'ielts-authoring')}>
          <Card className="p-6">
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-base">Title</Label>
                <Input
                  placeholder="Assignment title"
                  value={formState.title}
                  onChange={(event) =>
                    setFormState((current) => ({ ...current, title: event.target.value }))
                  }
                  className={cn(
                    formState.title.trim() && 'form-input-valid',
                  )}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-base">Course</Label>
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
                    {courses.map((course) => (
                      <SelectItem key={course.id} value={course.id}>
                        {course.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>

          <div className="space-y-4">
            <Label className="text-base">IELTS Skill Type</Label>
            <IeltsTypeCards
              value={selectedIeltsType}
              onChange={(type: IeltsAssignmentType) => handleTypeChange(type)}
            />
          </div>

          <div className="space-y-2">
            <Label>Other Assignment Types</Label>
            <Select
              value={selectedIeltsType ? '' : formState.type}
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

          <div className="space-y-3">
            <Label className="text-base">{isIelts ? 'Overview (shown in assignment list)' : 'Description'}</Label>
            <Textarea
              rows={4}
              placeholder="Assignment instructions..."
              value={formState.description}
              onChange={(event) =>
                setFormState((current) => ({ ...current, description: event.target.value }))
              }
              className="resize-none"
            />
            {isIelts && (
              <p className="text-xs text-muted-foreground">
                Student-facing instructions live inside the IELTS builder below.
              </p>
            )}
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-base">Due Date</Label>
              <Input
                type="datetime-local"
                value={formState.dueAt}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, dueAt: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label className="text-base">Max Score</Label>
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

          {selectedIeltsType && assignmentConfig && (
            <IeltsAssignmentBuilder
              type={selectedIeltsType}
              value={assignmentConfig}
              onChange={setAssignmentConfig}
              onTypeChange={(nextType, nextConfig) => {
                setFormState((current) => ({ ...current, type: nextType }));
                setAssignmentConfig(nextConfig);
              }}
              showTypeSelector={false}
            />
          )}
        </div>
        <DialogFooter className="sticky bottom-0 -mx-6 border-t bg-background/95 px-8 py-5 backdrop-blur supports-[backdrop-filter]:bg-background/80 gap-3">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            className="min-w-[100px]"
          >
            Cancel
          </Button>
          <Button
            variant="secondary"
            onClick={() => handleCreateAssignment(false)}
            disabled={createAssignmentMutation.isLoading}
            className="min-w-[120px]"
          >
            Save Draft
          </Button>
          <Button
            onClick={() => handleCreateAssignment(true)}
            disabled={createAssignmentMutation.isLoading}
            className="min-w-[140px] shadow-sm"
          >
            {createAssignmentMutation.isLoading ? 'Saving...' : 'Create & Publish'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
