/**
 * Location: features/assignments/components/TeacherAssignmentOverviewTab.tsx
 * Purpose: Render the overview tab with stats cards and assignment details.
 *          Now supports inline editing for title, description, due date, and max score.
 * Why: Allows teachers to edit basic assignment info without leaving the detail view.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@components/ui/card';
import { Badge } from '@components/ui/badge';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { Textarea } from '@components/ui/textarea';
import type { Assignment } from '@domain';
import type { TeacherAssignmentStatCard } from './TeacherAssignmentDetailTabs';

const formatTypeLabel = (value: string) =>
  value ? value.charAt(0).toUpperCase() + value.slice(1) : 'Unknown';

const toDateTimeLocal = (dateValue: Date) =>
  new Date(dateValue).toISOString().slice(0, 16);

const fromDateTimeLocal = (value: string): Date => {
  const date = new Date(value);
  return isNaN(date.getTime()) ? new Date() : date;
};

type TeacherAssignmentOverviewTabProps = {
  assignment: Assignment;
  courseTitle: string;
  statsCards: TeacherAssignmentStatCard[];
  isEditing?: boolean;
  onAssignmentChange?: (updates: Partial<Assignment>) => void;
};

export function TeacherAssignmentOverviewTab({
  assignment,
  courseTitle,
  statsCards,
  isEditing = false,
  onAssignmentChange,
}: TeacherAssignmentOverviewTabProps) {
  return (
    <>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsCards.map(stat => (
          <Card key={stat.label} className="rounded-[14px]">
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

      <Card className="rounded-[14px]">
        <CardHeader>
          <CardTitle>Assignment Details</CardTitle>
          <CardDescription>
            {isEditing ? 'Edit key settings below' : 'Review key settings at a glance'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="assignment-title">Title</Label>
              <Input
                id="assignment-title"
                value={assignment.title}
                disabled={!isEditing}
                onChange={(e) => onAssignmentChange?.({ title: e.target.value })}
                className={isEditing ? 'bg-background' : ''}
              />
            </div>
            <div className="space-y-2">
              <Label>Course</Label>
              <Input value={courseTitle} disabled />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="assignment-description">Description</Label>
            <Textarea
              id="assignment-description"
              value={assignment.description}
              rows={4}
              disabled={!isEditing}
              onChange={(e) => onAssignmentChange?.({ description: e.target.value })}
              className={isEditing ? 'bg-background resize-none' : 'resize-none'}
              placeholder="Enter assignment description..."
            />
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Input value={formatTypeLabel(assignment.type)} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="assignment-due-date">Due Date</Label>
              <Input
                id="assignment-due-date"
                type="datetime-local"
                value={toDateTimeLocal(assignment.dueAt)}
                disabled={!isEditing}
                onChange={(e) => onAssignmentChange?.({ dueAt: fromDateTimeLocal(e.target.value) })}
                className={isEditing ? 'bg-background' : ''}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="assignment-max-score">Max Score</Label>
              <Input
                id="assignment-max-score"
                type="number"
                min={0}
                max={1000}
                value={assignment.maxScore}
                disabled={!isEditing}
                onChange={(e) => onAssignmentChange?.({ maxScore: parseInt(e.target.value) || 0 })}
                className={isEditing ? 'bg-background' : ''}
              />
            </div>
          </div>
          <div className="pt-4 border-t">
            <div className="flex items-center justify-between">
              <div>
                <Label>Status</Label>
                <p className="text-sm text-muted-foreground">
                  {assignment.status === 'published'
                    ? 'Visible to students'
                    : 'Hidden from students'}
                </p>
              </div>
              <Badge
                variant={assignment.status === 'published' ? 'default' : 'secondary'}
                className="capitalize"
              >
                {assignment.status}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
