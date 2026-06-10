/**
 * Location: features/assignments/components/AiFeedbackReviewPanel.tsx
 * Purpose: Let teachers request, edit, approve, reject, finalize, and regenerate AI writing drafts.
 * Why: AI feedback must stay inside the teacher grading workflow before becoming final feedback.
 */

import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Bot, CheckCircle2, RefreshCw, Send, XCircle } from 'lucide-react';
import { toast } from 'sonner@2.0.3';

import { Alert, AlertDescription, AlertTitle } from '@components/ui/alert';
import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@components/ui/card';
import { Label } from '@components/ui/label';
import { Textarea } from '@components/ui/textarea';
import type { Assignment } from '@domain';
import {
  isIeltsAssignmentType,
  normalizeIeltsAssignmentConfig,
  type IeltsAssignmentType,
} from '@lib/ielts';
import {
  useApproveWritingFeedbackMutation,
  useFinalizeWritingFeedbackMutation,
  useRegenerateWritingFeedbackMutation,
  useRejectWritingFeedbackMutation,
  useRequestWritingFeedbackMutation,
  useWritingFeedbackHistoryQuery,
  useWritingFeedbackStatusQuery,
} from '@features/ai-feedback/api';
import {
  buildWritingFeedbackDraftView,
  extractEditableFeedback,
  extractTeacherEditedFeedback,
} from '@features/ai-feedback/ui.logic';
import type { WritingFeedbackReviewResponse } from '@features/ai-feedback/types';

type AiFeedbackReviewPanelProps = {
  assignment: Assignment;
  feedback: string;
  onFeedbackChange: (feedback: string) => void;
  submissionId: string;
};

const activeStatuses = new Set(['queued', 'running']);

function isWritingPolicyEnabled(assignment: Assignment) {
  if (!isIeltsAssignmentType(assignment.type) || assignment.type !== 'writing') {
    return false;
  }
  const config = normalizeIeltsAssignmentConfig(
    assignment.type as IeltsAssignmentType,
    assignment.assignmentConfig,
  );
  return config.aiPolicy.writingFeedbackMode !== 'off';
}

function latestReviewDraft(
  history: WritingFeedbackReviewResponse[] | undefined,
  statusDraft: WritingFeedbackReviewResponse | null | undefined,
) {
  if (history && history.length > 0) {
    return history[0];
  }
  return statusDraft ?? null;
}

function toneClasses(tone: ReturnType<typeof buildWritingFeedbackDraftView>['tone']) {
  switch (tone) {
    case 'success':
      return 'border-emerald-200 bg-emerald-50 text-emerald-900';
    case 'warning':
      return 'border-amber-200 bg-amber-50 text-amber-900';
    case 'destructive':
      return 'border-destructive/20 bg-destructive/5 text-destructive';
    case 'info':
      return 'border-sky-200 bg-sky-50 text-sky-900';
    case 'muted':
      return '';
  }
}

function mutationErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'AI feedback action failed.';
}

export function AiFeedbackReviewPanel({
  assignment,
  feedback,
  onFeedbackChange,
  submissionId,
}: AiFeedbackReviewPanelProps) {
  const enabled = isWritingPolicyEnabled(assignment);
  const statusQuery = useWritingFeedbackStatusQuery(submissionId, enabled);
  const historyQuery = useWritingFeedbackHistoryQuery(submissionId, enabled);
  const requestMutation = useRequestWritingFeedbackMutation(submissionId);
  const regenerateMutation = useRegenerateWritingFeedbackMutation(submissionId);
  const approveMutation = useApproveWritingFeedbackMutation(submissionId);
  const finalizeMutation = useFinalizeWritingFeedbackMutation(submissionId);
  const rejectMutation = useRejectWritingFeedbackMutation(submissionId);
  const [editedFeedback, setEditedFeedback] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');

  const statusDraft = statusQuery.data as WritingFeedbackReviewResponse | null | undefined;
  const draft = latestReviewDraft(historyQuery.data, statusDraft);
  const view = buildWritingFeedbackDraftView(draft);
  const isPending =
    requestMutation.isPending ||
    regenerateMutation.isPending ||
    approveMutation.isPending ||
    finalizeMutation.isPending ||
    rejectMutation.isPending;

  const generatedText = useMemo(() => {
    if (!draft) {
      return '';
    }
    return (
      extractTeacherEditedFeedback(draft) ||
      extractEditableFeedback(draft.feedback) ||
      feedback
    );
  }, [draft, feedback]);

  useEffect(() => {
    setEditedFeedback(generatedText);
    setRejectionReason('');
  }, [draft?.id, generatedText]);

  if (!enabled) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bot className="size-4" />
            AI Writing Feedback
          </CardTitle>
          <CardDescription>AI writing feedback is disabled for this assignment.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const handleRequest = async () => {
    try {
      await requestMutation.mutateAsync();
      toast.success('AI writing feedback requested.');
    } catch (error) {
      toast.error(mutationErrorMessage(error));
    }
  };

  const handleRegenerate = async () => {
    try {
      await regenerateMutation.mutateAsync(undefined);
      toast.success('AI writing feedback regeneration requested.');
    } catch (error) {
      toast.error(mutationErrorMessage(error));
    }
  };

  const handleApprove = async () => {
    if (!draft || !editedFeedback.trim()) {
      toast.error('Teacher feedback is required before approval.');
      return;
    }
    try {
      await approveMutation.mutateAsync({
        draftId: draft.id,
        payload: { feedbackMd: editedFeedback.trim() },
      });
      onFeedbackChange(editedFeedback.trim());
      toast.success('AI feedback approved into grade feedback.');
    } catch (error) {
      toast.error(mutationErrorMessage(error));
    }
  };

  const handleFinalize = async () => {
    if (!draft || !editedFeedback.trim()) {
      toast.error('Teacher feedback is required before finalization.');
      return;
    }
    try {
      await finalizeMutation.mutateAsync({
        draftId: draft.id,
        payload: { feedbackMd: editedFeedback.trim() },
      });
      onFeedbackChange(editedFeedback.trim());
      toast.success('AI feedback finalized as teacher feedback.');
    } catch (error) {
      toast.error(mutationErrorMessage(error));
    }
  };

  const handleReject = async () => {
    if (!draft) {
      return;
    }
    try {
      await rejectMutation.mutateAsync({
        draftId: draft.id,
        payload: rejectionReason.trim() ? { reason: rejectionReason.trim() } : undefined,
      });
      toast.success('AI feedback draft rejected.');
    } catch (error) {
      toast.error(mutationErrorMessage(error));
    }
  };

  const useDraftInFeedback = () => {
    if (!editedFeedback.trim()) {
      toast.error('No AI draft text is available to use.');
      return;
    }
    onFeedbackChange(editedFeedback.trim());
  };

  const active = draft ? activeStatuses.has(draft.status) : false;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bot className="size-4" />
              AI Writing Feedback
            </CardTitle>
            <CardDescription>
              Review AI-assisted writing feedback before it becomes teacher-final.
            </CardDescription>
          </div>
          <Badge variant={draft ? 'secondary' : 'outline'}>{view.label}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {(statusQuery.error || historyQuery.error) && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>AI feedback is unavailable</AlertTitle>
            <AlertDescription>
              {mutationErrorMessage(statusQuery.error ?? historyQuery.error)}
            </AlertDescription>
          </Alert>
        )}

        <Alert className={toneClasses(view.tone)}>
          <AlertCircle className="size-4" />
          <AlertTitle>{view.label}</AlertTitle>
          <AlertDescription>{view.description}</AlertDescription>
        </Alert>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="default"
            onClick={handleRequest}
            disabled={isPending || active || Boolean(draft)}
          >
            <Send className="mr-2 size-4" />
            Request AI Draft
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleRegenerate}
            disabled={isPending || active || !draft}
          >
            <RefreshCw className="mr-2 size-4" />
            Regenerate
          </Button>
        </div>

        {draft && (
          <div className="space-y-3 rounded-lg border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label htmlFor="ai-feedback-draft">Teacher-edited AI feedback</Label>
              <Button type="button" variant="ghost" size="sm" onClick={useDraftInFeedback}>
                Use in feedback field
              </Button>
            </div>
            <Textarea
              id="ai-feedback-draft"
              rows={8}
              value={editedFeedback}
              onChange={(event) => setEditedFeedback(event.target.value)}
              disabled={!view.canDecide}
              placeholder="AI draft text will appear here when feedback is ready."
            />
            <p className="text-xs leading-5 text-muted-foreground">
              Teacher-reviewed drafts stay hidden from students until approval. Instant provisional
              drafts remain provisional until finalized.
            </p>
          </div>
        )}

        {draft && view.canDecide && (
          <div className="space-y-3 rounded-lg border p-4">
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={handleApprove} disabled={isPending}>
                <CheckCircle2 className="mr-2 size-4" />
                Approve
              </Button>
              {view.canFinalize && (
                <Button type="button" variant="secondary" onClick={handleFinalize} disabled={isPending}>
                  <CheckCircle2 className="mr-2 size-4" />
                  Finalize
                </Button>
              )}
              <Button type="button" variant="destructive" onClick={handleReject} disabled={isPending}>
                <XCircle className="mr-2 size-4" />
                Reject
              </Button>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ai-feedback-rejection">Rejection reason</Label>
              <Textarea
                id="ai-feedback-rejection"
                rows={3}
                value={rejectionReason}
                onChange={(event) => setRejectionReason(event.target.value)}
                placeholder="Optional note retained with the rejected draft."
              />
            </div>
          </div>
        )}

        {historyQuery.data && historyQuery.data.length > 1 && (
          <div className="space-y-2">
            <Label>Draft history</Label>
            <div className="space-y-2">
              {historyQuery.data.slice(1, 4).map((item) => {
                const itemView = buildWritingFeedbackDraftView(item);
                return (
                  <div key={item.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                    <span>{itemView.label}</span>
                    <Badge variant="outline">{item.visibilityMode.replace(/_/g, ' ')}</Badge>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
