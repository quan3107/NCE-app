/**
 * Location: features/assignments/components/StudentAssignmentStatusAlerts.tsx
 * Purpose: Render assignment due/submission state alerts for students.
 * Why: Keeps status messaging separate from detail-page mutation logic.
 */

import { AlertCircle, CheckCircle2, Clock, Info } from 'lucide-react';
import { Alert, AlertDescription } from '@components/ui/alert';
import type { Assignment, Submission } from '@domain';
import { formatDate } from '@lib/utils';

type StudentAssignmentStatusAlertsProps = {
  assignment: Assignment;
  dueDate: Date;
  submission: Submission | null;
  isOverdue: boolean;
  isDueSoon: boolean;
  hasReachedMaxAttempts: boolean;
};

export function StudentAssignmentStatusAlerts({
  assignment,
  dueDate,
  submission,
  isOverdue,
  isDueSoon,
  hasReachedMaxAttempts,
}: StudentAssignmentStatusAlertsProps) {
  return (
    <>
      {isOverdue && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>
            This assignment was due on {formatDate(dueDate, 'datetime')}. {assignment.latePolicy}
          </AlertDescription>
        </Alert>
      )}
      {isDueSoon && !submission && (
        <Alert>
          <Clock className="size-4" />
          <AlertDescription>
            This assignment is due soon: {formatDate(dueDate, 'datetime')}
          </AlertDescription>
        </Alert>
      )}
      {submission && (
        <Alert className="bg-green-500/10 border-green-200">
          <CheckCircle2 className="size-4 text-green-700" />
          <AlertDescription className="text-green-700">
            {submission.submittedAt
              ? `Submitted on ${formatDate(new Date(submission.submittedAt), 'datetime')}`
              : 'Draft saved'}
            {submission.version > 1 && ` (Version ${submission.version})`}
          </AlertDescription>
        </Alert>
      )}
      {hasReachedMaxAttempts && (
        <Alert>
          <Info className="size-4" />
          <AlertDescription>Maximum attempts reached for this assignment.</AlertDescription>
        </Alert>
      )}
    </>
  );
}
