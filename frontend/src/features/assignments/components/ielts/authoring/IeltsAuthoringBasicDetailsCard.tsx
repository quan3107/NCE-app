/**
 * Location: features/assignments/components/ielts/authoring/IeltsAuthoringBasicDetailsCard.tsx
 * Purpose: Render the basic details card for IELTS authoring.
 * Why: Keeps the create page file under size limits while matching Figma layout.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/card';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@components/ui/select';
import { Switch } from '@components/ui/switch';
import { Textarea } from '@components/ui/textarea';
import type { Course } from '@domain';

type IeltsAuthoringBasicDetailsCardProps = {
  courses: Course[];
  assignmentTitle: string;
  onAssignmentTitleChange: (value: string) => void;
  courseId: string;
  onCourseChange: (value: string) => void;
  instructions: string;
  onInstructionsChange: (value: string) => void;
  timingEnabled: boolean;
  onTimingEnabledChange: (value: boolean) => void;
  durationMinutes: number;
  onDurationMinutesChange: (value: number) => void;
  enforceTime: boolean;
  onEnforceTimeChange: (value: boolean) => void;
  dueDate: string;
  dueDateErrorId?: string;
  onDueDateChange: (value: string) => void;
};

export function IeltsAuthoringBasicDetailsCard({
  courses,
  assignmentTitle,
  onAssignmentTitleChange,
  courseId,
  onCourseChange,
  instructions,
  onInstructionsChange,
  timingEnabled,
  onTimingEnabledChange,
  durationMinutes,
  onDurationMinutesChange,
  enforceTime,
  onEnforceTimeChange,
  dueDate,
  dueDateErrorId,
  onDueDateChange,
}: IeltsAuthoringBasicDetailsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Basic Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="ielts-title">Assignment Title *</Label>
            <Input
              id="ielts-title"
              value={assignmentTitle}
              onChange={(event) => onAssignmentTitleChange(event.target.value)}
              placeholder="e.g., IELTS Reading Practice Test 1"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ielts-course">Course *</Label>
            <Select value={courseId} onValueChange={onCourseChange}>
              <SelectTrigger id="ielts-course">
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
          <Label htmlFor="ielts-instructions">Instructions</Label>
          <Textarea
            id="ielts-instructions"
            value={instructions}
            onChange={(event) => onInstructionsChange(event.target.value)}
            placeholder="Provide instructions for students..."
            rows={3}
          />
        </div>

        <div className="space-y-4 pt-4 border-t">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="ielts-timing">Timing</Label>
              <p className="text-sm text-muted-foreground">
                Enable time limits for this assignment
              </p>
            </div>
            <Switch id="ielts-timing" checked={timingEnabled} onCheckedChange={onTimingEnabledChange} />
          </div>

          {timingEnabled && (
            <div className="grid md:grid-cols-2 gap-4 pl-4 border-l-2">
              <div className="space-y-2">
                <Label htmlFor="ielts-duration">Duration (minutes)</Label>
                <Input
                  id="ielts-duration"
                  type="number"
                  value={durationMinutes}
                  onChange={(event) =>
                    onDurationMinutesChange(parseInt(event.target.value, 10) || 60)
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="ielts-enforce-time">Enforce Time Limit</Label>
                  <p className="text-sm text-muted-foreground">
                    Auto-submit when time expires
                  </p>
                </div>
                <Switch id="ielts-enforce-time" checked={enforceTime} onCheckedChange={onEnforceTimeChange} />
              </div>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="ielts-due-date">Due Date *</Label>
          <Input
            id="ielts-due-date"
            type="datetime-local"
            value={dueDate}
            aria-invalid={Boolean(dueDateErrorId)}
            aria-describedby={dueDateErrorId}
            onChange={(event) => onDueDateChange(event.target.value)}
          />
        </div>
      </CardContent>
    </Card>
  );
}
