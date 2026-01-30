/**
 * Location: features/assignments/components/TeacherAssignmentOverviewTab.tsx
 * Purpose: Render the overview tab with stats cards and assignment details.
 * Why: Matches the Figma Make detail page while keeping the main screen lean.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@components/ui/card';
import { Badge } from '@components/ui/badge';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { Textarea } from '@components/ui/textarea';
import type { Assignment } from '@lib/mock-data';
import type { TeacherAssignmentStatCard } from './TeacherAssignmentDetailTabs';

const formatTypeLabel = (value: string) =>
  value ? value.charAt(0).toUpperCase() + value.slice(1) : 'Unknown';

const toDateTimeLocal = (dateValue: Date) =>
  new Date(dateValue).toISOString().slice(0, 16);

type TeacherAssignmentOverviewTabProps = {
  assignment: Assignment;
  courseTitle: string;
  statsCards: TeacherAssignmentStatCard[];
};

export function TeacherAssignmentOverviewTab({
  assignment,
  courseTitle,
  statsCards,
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
          <CardDescription>Review key settings at a glance</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={assignment.title} disabled />
            </div>
            <div className="space-y-2">
              <Label>Course</Label>
              <Input value={courseTitle} disabled />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={assignment.description} rows={4} disabled />
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Input value={formatTypeLabel(assignment.type)} disabled />
            </div>
            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input type="datetime-local" value={toDateTimeLocal(assignment.dueAt)} disabled />
            </div>
            <div className="space-y-2">
              <Label>Max Score</Label>
              <Input type="number" value={assignment.maxScore} disabled />
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
