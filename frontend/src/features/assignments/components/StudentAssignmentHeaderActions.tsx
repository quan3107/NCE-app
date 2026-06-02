/**
 * Location: features/assignments/components/StudentAssignmentHeaderActions.tsx
 * Purpose: Render student assignment submit/resubmit header actions.
 * Why: Keeps action-state branching out of the detail page.
 */

import { CheckCircle2 } from 'lucide-react';
import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import type { Submission } from '@domain';

type StudentAssignmentHeaderActionsProps = {
  submission: Submission | null;
  isOverdue: boolean;
  canResubmit: boolean;
  hasReachedMaxAttempts: boolean;
  onOpenSubmit: () => void;
};

export function StudentAssignmentHeaderActions({
  submission,
  isOverdue,
  canResubmit,
  hasReachedMaxAttempts,
  onOpenSubmit,
}: StudentAssignmentHeaderActionsProps) {
  if (!submission) {
    return (
      <Button onClick={onOpenSubmit} disabled={isOverdue || hasReachedMaxAttempts}>
        {isOverdue
          ? 'Past Due'
          : hasReachedMaxAttempts
            ? 'Max Attempts Reached'
            : 'Submit Assignment'}
      </Button>
    );
  }

  if (canResubmit) {
    return (
      <Button variant="outline" onClick={onOpenSubmit}>
        Resubmit Assignment
      </Button>
    );
  }

  return (
    <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-200">
      <CheckCircle2 className="size-4 mr-2" />
      {submission.status === 'graded'
        ? 'Graded'
        : submission.status === 'draft'
          ? 'Draft Saved'
          : 'Submitted'}
    </Badge>
  );
}
