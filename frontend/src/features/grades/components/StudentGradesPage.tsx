/**
 * Location: features/grades/components/StudentGradesPage.tsx
 * Purpose: Render the Student Grades Page component for the Grades domain.
 * Why: Keeps the feature module organized under the new structure.
 */

import { useEffect, useMemo, useState } from 'react';

import { Card, CardContent } from '@components/ui/card';
import { Button } from '@components/ui/button';
import { Label } from '@components/ui/label';
import { Progress } from '@components/ui/progress';
import { PageHeader } from '@components/common/PageHeader';
import { useRouter } from '@lib/router';
import { useAuthStore } from '@store/authStore';
import { Award, Loader2, MessageSquareText } from 'lucide-react';
import { formatDate } from '@lib/utils';
import { useAssignmentResources } from '@features/assignments/api';
import {
  ObjectiveExplanationPollingTimeoutError,
  pollObjectiveExplanationUntilSettled,
  requestObjectiveExplanation,
  restoreObjectiveExplanations,
  useGradesQuery,
  type ObjectiveExplanationResponse,
  type ObjectiveExplanationStatus,
} from '@features/grades/api';
import { extractEditableFeedback } from '@features/ai-feedback/ui.logic';
import { getEligibleObjectiveExplanationTargets } from '@features/grades/objectiveExplanationEligibility';
import {
  readRememberedExplanationKeys,
  rememberExplanationKey,
} from '@features/grades/objectiveExplanationMemory';
import type { Submission } from '@domain';
import {
  explanationText,
  renderFeedbackContent,
  rubricProgressValue,
  rubricScoreLabel,
  scoreSummary,
  toFeedbackLabel,
} from './StudentGradePresentation';

type ExplanationViewStatus = ObjectiveExplanationStatus | 'polling_timeout';

type ExplanationState = {
  status: ExplanationViewStatus;
  cached: boolean;
  explanation?: Record<string, unknown>;
  failureCode?: string;
  failureMessage?: string;
  error?: string;
};

const explanationKey = (submissionId: string, questionId: string) =>
  `${submissionId}:${questionId}`;

const toExplanationState = (
  response: ObjectiveExplanationResponse,
): ExplanationState => ({
  status: response.status,
  cached: response.cached,
  explanation: response.explanation,
  failureCode: response.failureCode,
  failureMessage: response.failureMessage,
});

export function StudentGradesPage() {
  const { currentUser } = useAuthStore();
  const { navigate } = useRouter();
  const [explanations, setExplanations] = useState<
    Record<string, ExplanationState>
  >({});
  const {
    submissions,
    assignments,
    isLoading: assignmentsLoading,
    error: assignmentsError,
  } = useAssignmentResources();
  const studentSubmissions = useMemo(
    () =>
      submissions.filter(
        (submission) => submission.studentId === currentUser?.id,
      ),
    [submissions, currentUser?.id],
  );
  const eligibleExplanationLookups = useMemo(
    () =>
      studentSubmissions.flatMap((submission) => {
        const assignment = assignments.find(
          (candidate) => candidate.id === submission.assignmentId,
        );
        if (!assignment) {
          return [];
        }

        return getEligibleObjectiveExplanationTargets(
          assignment,
          submission,
        ).map((target) => ({
          submissionId: submission.id,
          questionId: target.id,
        }));
      }),
    [assignments, studentSubmissions],
  );
  const restorableExplanationLookups = useMemo(() => {
    if (!currentUser) {
      return [];
    }
    const remembered = readRememberedExplanationKeys(currentUser.id);
    return eligibleExplanationLookups.filter(({ submissionId, questionId }) =>
      remembered.has(explanationKey(submissionId, questionId)),
    );
  }, [currentUser, eligibleExplanationLookups]);
  const gradesQuery = useGradesQuery(studentSubmissions, assignments);

  useEffect(() => {
    if (
      !currentUser ||
      assignmentsLoading ||
      restorableExplanationLookups.length === 0
    ) {
      return;
    }

    let active = true;
    void restoreObjectiveExplanations(restorableExplanationLookups).then(
      (restored) => {
        if (!active || restored.length === 0) {
          return;
        }

        setExplanations((previous) => {
          const next = { ...previous };
          let changed = false;

          restored.forEach(({ submissionId, questionId, response }) => {
            const key = explanationKey(submissionId, questionId);
            if (next[key]) {
              return;
            }
            next[key] = toExplanationState(response);
            changed = true;
          });

          return changed ? next : previous;
        });
      },
    );

    return () => {
      active = false;
    };
  }, [assignmentsLoading, currentUser, restorableExplanationLookups]);

  if (!currentUser) return null;

  const isLoading = assignmentsLoading || gradesQuery.isLoading;
  const error = assignmentsError ?? gradesQuery.error;

  const handleExplain = async (submission: Submission, questionId: string) => {
    const key = explanationKey(submission.id, questionId);
    rememberExplanationKey(currentUser.id, key);
    setExplanations((prev) => ({
      ...prev,
      [key]: { status: 'queued', cached: false },
    }));

    try {
      const response = await requestObjectiveExplanation(
        submission.id,
        questionId,
      );
      const settledResponse =
        response.status === 'queued' || response.status === 'running'
          ? await pollObjectiveExplanationUntilSettled(
              submission.id,
              questionId,
              response,
            )
          : response;

      setExplanations((prev) => ({
        ...prev,
        [key]: toExplanationState(settledResponse),
      }));
    } catch (caught) {
      setExplanations((prev) => ({
        ...prev,
        [key]: {
          status:
            caught instanceof ObjectiveExplanationPollingTimeoutError
              ? 'polling_timeout'
              : 'failed',
          cached: false,
          error:
            caught instanceof ObjectiveExplanationPollingTimeoutError
              ? 'Explanation is still running. Try again in a moment.'
              : caught instanceof Error
                ? caught.message
                : 'Unable to request explanation.',
        },
      }));
    }
  };

  if (isLoading) {
    return (
      <div>
        <PageHeader
          title="Grades"
          description="View your grades and feedback"
        />
        <div className="p-4 sm:p-6 lg:p-8">
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Loading grades...
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <PageHeader
          title="Grades"
          description="View your grades and feedback"
        />
        <div className="p-4 sm:p-6 lg:p-8">
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-destructive font-medium">
                Unable to load grades.
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                {error.message}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const grades = gradesQuery.data ?? [];
  const gradedSubmissions = studentSubmissions.filter((submission) =>
    grades.some((grade) => grade.submissionId === submission.id),
  );

  return (
    <div>
      <PageHeader title="Grades" description="View your grades and feedback" />
      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        {gradedSubmissions.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Award className="size-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="mb-2">No Grades Yet</h3>
              <p className="text-muted-foreground mb-4">
                Complete and submit assignments to receive grades
              </p>
              <Button onClick={() => navigate('/student/assignments')}>
                View Assignments
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {gradedSubmissions.map((submission) => {
              const grade = grades.find(
                (g) => g.submissionId === submission.id,
              );
              const assignment = assignments.find(
                (a) => a.id === submission.assignmentId,
              );
              if (!grade || !assignment) return null;

              const hasOfficialGrade = !grade.provisionalOnly;
              const displayScore = scoreSummary(grade);
              const explanationTargets = getEligibleObjectiveExplanationTargets(
                assignment,
                submission,
              );
              const provisionalFeedback = extractEditableFeedback(
                grade.studentAiFeedback?.feedback,
              );

              return (
                <Card
                  key={submission.id}
                  className="hover:shadow-md transition-shadow"
                >
                  <CardContent className="p-6">
                    <div className="space-y-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="mb-1">{assignment.title}</h3>
                          <p className="text-sm text-muted-foreground">
                            {assignment.courseName}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className={displayScore.className}>
                            {displayScore.primary}
                          </div>
                          {displayScore.secondary !== null && (
                            <div className="text-sm text-muted-foreground">
                              {displayScore.secondary}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Rubric Breakdown */}
                      {hasOfficialGrade && grade.rubricBreakdown.length > 0 && (
                        <div className="space-y-2">
                          <Label>Rubric Breakdown</Label>
                          {grade.rubricBreakdown.map((item, i) => (
                            <div key={i} className="flex items-center gap-3">
                              <div className="flex-1">
                                <div className="flex items-center justify-between text-sm mb-1">
                                  <span>{item.criteria}</span>
                                  <span className="font-medium">
                                    {rubricScoreLabel(item)}
                                  </span>
                                </div>
                                <Progress
                                  value={rubricProgressValue(item)}
                                  className="h-1.5"
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Feedback */}
                      {grade.feedback && (
                        <div className="space-y-2">
                          <Label>{toFeedbackLabel(grade.feedbackLabel)}</Label>
                          <div className="p-6 bg-gradient-to-br from-muted/30 to-muted/60 rounded-xl border border-border/50 space-y-4">
                            {renderFeedbackContent(grade.feedback)}
                          </div>
                        </div>
                      )}

                      {provisionalFeedback && (
                        <div className="space-y-2">
                          <Label>Provisional AI Feedback</Label>
                          <div className="rounded-md border border-dashed border-primary/40 bg-primary/5 p-4">
                            <p className="text-sm text-foreground/85 whitespace-pre-wrap">
                              {provisionalFeedback}
                            </p>
                          </div>
                        </div>
                      )}

                      {explanationTargets.length > 0 && (
                        <div className="space-y-2">
                          <Label>Question Explanations</Label>
                          <div className="space-y-2">
                            {explanationTargets.map((target, index) => {
                              const state =
                                explanations[
                                  explanationKey(submission.id, target.id)
                                ];
                              const active =
                                state?.status === 'queued' ||
                                state?.status === 'running';
                              const ready =
                                state?.status === 'completed' &&
                                state.explanation;
                              const retryable =
                                state?.status === 'polling_timeout';
                              const terminalUnavailable =
                                state?.status === 'review_required' ||
                                state?.status === 'rejected';
                              return (
                                <div
                                  key={target.id}
                                  className="rounded-md border border-border bg-background p-3"
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <p className="text-xs text-muted-foreground">
                                        Question {index + 1}
                                      </p>
                                      <p className="text-sm font-medium">
                                        {target.prompt}
                                      </p>
                                    </div>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      disabled={
                                        active ||
                                        Boolean(ready) ||
                                        terminalUnavailable
                                      }
                                      onClick={() =>
                                        void handleExplain(
                                          submission,
                                          target.id,
                                        )
                                      }
                                    >
                                      {active ? (
                                        <Loader2 className="size-4 animate-spin" />
                                      ) : (
                                        <MessageSquareText className="size-4" />
                                      )}
                                      {ready
                                        ? 'Ready'
                                        : active
                                          ? 'Queued'
                                          : retryable
                                            ? 'Retry'
                                            : terminalUnavailable
                                              ? 'Unavailable'
                                              : 'Explain'}
                                    </Button>
                                  </div>
                                  {ready && (
                                    <p className="mt-3 rounded-md bg-muted/40 p-3 text-sm text-foreground/85">
                                      {explanationText(state.explanation)}
                                    </p>
                                  )}
                                  {state?.status === 'polling_timeout' && (
                                    <p className="mt-3 text-sm text-muted-foreground">
                                      {state.error ??
                                        'Explanation is still running. Try again in a moment.'}
                                    </p>
                                  )}
                                  {state?.status === 'failed' && (
                                    <p className="mt-3 text-sm text-destructive">
                                      {state.failureMessage ??
                                        state.error ??
                                        'Explanation failed.'}
                                    </p>
                                  )}
                                  {(state?.status === 'review_required' ||
                                    state?.status === 'rejected') && (
                                    <p className="mt-3 text-sm text-muted-foreground">
                                      {state.failureMessage ??
                                        'Explanation is not available for this question.'}
                                    </p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {grade.gradedAt && grade.gradedBy && (
                        <div className="flex items-center justify-between text-sm text-muted-foreground pt-2 border-t">
                          <span>Graded by {grade.gradedBy}</span>
                          <span>{formatDate(grade.gradedAt, 'datetime')}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
