/**
 * Location: features/assignments/components/StudentAssignmentSidebar.tsx
 * Purpose: Render the assignment detail sidebar for students.
 * Why: Keeps the main assignment detail page concise and focused.
 */

import type { Assignment } from '@domain';
import { Button } from '@components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/card';
import { Label } from '@components/ui/label';
import { formatDate } from '@lib/utils';
import { FileText, Link as LinkIcon, Type, Upload } from 'lucide-react';

type StudentAssignmentSidebarProps = {
  assignment: Assignment;
  dueDate: Date;
  isOverdue: boolean;
  onViewAssignments: () => void;
};

const getTypeIcon = (type: Assignment['type']) => {
  switch (type) {
    case 'file':
      return <Upload className="size-5" />;
    case 'link':
      return <LinkIcon className="size-5" />;
    case 'text':
      return <Type className="size-5" />;
    default:
      return <FileText className="size-5" />;
  }
};

export function StudentAssignmentSidebar({
  assignment,
  dueDate,
  isOverdue,
  onViewAssignments,
}: StudentAssignmentSidebarProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Type</Label>
            <div className="flex items-center gap-2 mt-2">
              {getTypeIcon(assignment.type)}
              <span className="capitalize">{assignment.type}</span>
            </div>
          </div>
          <div>
            <Label>Due Date</Label>
            <div className="mt-2">
              <p className={isOverdue ? 'text-red-600 font-medium' : ''}>
                {formatDate(dueDate, 'datetime')}
              </p>
              <p className="text-xs text-muted-foreground mt-1">UTC+07:00 (Bangkok)</p>
            </div>
          </div>
          <div>
            <Label>Late Policy</Label>
            <p className="text-sm mt-2 text-muted-foreground">{assignment.latePolicy}</p>
          </div>
          <div>
            <Label>Max Score</Label>
            <p className="text-sm mt-2">{assignment.maxScore} points</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Course</CardTitle>
        </CardHeader>
        <CardContent>
          <h4 className="mb-1">{assignment.courseName}</h4>
          <Button variant="outline" size="sm" className="w-full mt-3" onClick={onViewAssignments}>
            View All Assignments
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
