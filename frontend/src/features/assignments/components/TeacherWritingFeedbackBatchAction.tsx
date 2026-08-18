/**
 * Location: features/assignments/components/TeacherWritingFeedbackBatchAction.tsx
 * Purpose: Expose assignment-scoped teacher batch generation controls.
 * Why: Teachers need accessible bulk queueing with duplicate and result feedback.
 */
import { useMemo, useState } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@components/ui/alert';
import { Button } from '@components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@components/ui/card';
import { useRequestAssignmentWritingFeedbackBatchMutation } from '@features/ai-feedback/api';
import type {
  WritingFeedbackBatchRequest,
  WritingFeedbackBatchResponse,
} from '@features/ai-feedback/types';
import type { Assignment, Submission } from '@domain';
import { Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner@2.0.3';

type Props = {
  assignment: Assignment;
  submissions: Submission[];
};

type BatchSummary = {
  queued: number;
  skipped: number;
  conflicts: number;
};

const activeWritingModes = new Set([
  'teacher_reviewed',
  'instant_student_visible',
]);

const writingFeedbackEnabled = (assignment: Assignment): boolean => {
  if (assignment.type !== 'writing' || !assignment.assignmentConfig) {
    return false;
  }
  const policy = assignment.assignmentConfig.aiPolicy;
  if (!policy || typeof policy !== 'object') {
    return false;
  }
  return activeWritingModes.has(
    String((policy as Record<string, unknown>).writingFeedbackMode ?? ''),
  );
};

const selectableSubmission = (submission: Submission): boolean =>
  ['submitted', 'late', 'graded'].includes(submission.status);

const summarizeBatch = (response: WritingFeedbackBatchResponse): BatchSummary => {
  const queued = response.results.filter((result) => result.status === 'queued').length;
  const skipped = response.results.filter((result) => result.status === 'skipped').length;
  return {
    queued,
    skipped,
    conflicts: response.results.length - queued - skipped,
  };
};

export function TeacherWritingFeedbackBatchAction({
  assignment,
  submissions,
}: Props) {
  const mutation = useRequestAssignmentWritingFeedbackBatchMutation({
    courseId: assignment.courseId,
    assignmentId: assignment.id,
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [queuedIds, setQueuedIds] = useState<Set<string>>(new Set());
  const [summary, setSummary] = useState<BatchSummary | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const eligibleSubmissions = useMemo(
    () => submissions.filter(selectableSubmission),
    [submissions],
  );

  if (!writingFeedbackEnabled(assignment)) {
    return null;
  }

  const toggleSelected = (submissionId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(submissionId)) {
        next.delete(submissionId);
      } else {
        next.add(submissionId);
      }
      return next;
    });
  };

  const runBatch = async (payload: WritingFeedbackBatchRequest) => {
    setErrorMessage(null);
    try {
      const response = await mutation.mutateAsync(payload);
      const nextSummary = summarizeBatch(response);
      setSummary(nextSummary);
      setQueuedIds((current) => {
        const next = new Set(current);
        response.results.forEach((result) => {
          if (result.status === 'queued') {
            next.add(result.submissionId);
          }
        });
        return next;
      });
      setSelectedIds((current) => {
        const next = new Set(current);
        response.results.forEach((result) => {
          if (result.status === 'queued') {
            next.delete(result.submissionId);
          }
        });
        return next;
      });
      toast.success(
        `${nextSummary.queued} AI ${nextSummary.queued === 1 ? 'draft' : 'drafts'} queued.`,
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'AI writing feedback could not be queued.';
      setErrorMessage(message);
      toast.error(message);
    }
  };

  const selectedAvailableIds = [...selectedIds].filter(
    (submissionId) => !queuedIds.has(submissionId),
  );

  return (
    <Card className="rounded-[14px]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="size-4" />
          Batch AI writing drafts
        </CardTitle>
        <CardDescription>
          Queue assignment-scoped drafts. Existing queued or running drafts are
          skipped safely.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={mutation.isPending}
            onClick={() => void runBatch({ filter: 'ungraded' })}
          >
            {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
            Queue ungraded AI drafts
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={mutation.isPending}
            onClick={() => void runBatch({ filter: 'submitted' })}
          >
            Queue submitted AI drafts
          </Button>
        </div>

        {eligibleSubmissions.length > 0 && (
          <fieldset className="space-y-2 rounded-md border border-border p-3">
            <legend className="px-1 text-sm font-medium">
              Select eligible submissions
            </legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {eligibleSubmissions.map((submission) => {
                const queued = queuedIds.has(submission.id);
                return (
                  <label key={submission.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(submission.id)}
                      disabled={mutation.isPending || queued}
                      onChange={() => toggleSelected(submission.id)}
                    />
                    <span>
                      {submission.studentName}
                      {queued ? ' — already queued' : ''}
                    </span>
                  </label>
                );
              })}
            </div>
            <Button
              type="button"
              size="sm"
              disabled={mutation.isPending || selectedAvailableIds.length === 0}
              onClick={() =>
                void runBatch({ submissionIds: selectedAvailableIds })
              }
            >
              Queue selected AI drafts
            </Button>
          </fieldset>
        )}

        {summary && (
          <p role="status" className="text-sm text-muted-foreground">
            {summary.queued} queued, {summary.skipped} skipped, {summary.conflicts}{' '}
            {summary.conflicts === 1 ? 'conflict' : 'conflicts'}.
          </p>
        )}
        {errorMessage && (
          <Alert variant="destructive">
            <AlertTitle>Batch request failed</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
