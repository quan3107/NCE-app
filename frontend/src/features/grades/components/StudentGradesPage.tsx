/**
 * Location: features/grades/components/StudentGradesPage.tsx
 * Purpose: Render the Student Grades Page component for the Grades domain.
 * Why: Keeps the feature module organized under the new structure.
 */

import { useMemo, useState } from 'react';

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
  useGradesQuery,
  type ObjectiveExplanationResponse,
  type ObjectiveExplanationStatus,
} from '@features/grades/api';
import { extractEditableFeedback } from '@features/ai-feedback/ui.logic';
import {
  isIeltsAssignmentType,
  normalizeIeltsAssignmentConfig,
  type IeltsListeningConfig,
  type IeltsReadingConfig,
} from '@lib/ielts';
import { getStudentIeltsAnswerTargets } from '@features/assignments/components/ielts/student/studentIeltsAnswerTargets';
import type { Assignment, Grade, Submission } from '@domain';

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

const toFeedbackLabel = (label: Grade['feedbackLabel']) =>
  label === 'teacher-reviewed AI-assisted feedback'
    ? 'Teacher-reviewed AI-assisted Feedback'
    : 'Teacher Feedback';

const assertNever = (value: never): never => {
  throw new Error(`Unsupported score display: ${JSON.stringify(value)}`);
};

type ScoreSummary = {
  primary: string;
  secondary: string | null;
  className: string;
};

const formatBandScore = (value: number) => value.toFixed(1);

const scoreSummary = (grade: Grade): ScoreSummary => {
  if (grade.provisionalOnly) {
    return {
      primary: 'Provisional feedback',
      secondary: null,
      className: 'text-sm font-medium',
    };
  }

  if (grade.scoreDisplay.kind === 'ielts_band') {
    return {
      primary: formatBandScore(grade.scoreDisplay.value),
      secondary: null,
      className: 'text-3xl font-medium',
    };
  }

  if (grade.scoreDisplay.kind === 'unavailable') {
    return {
      primary: grade.scoreDisplay.label,
      secondary: null,
      className: 'text-sm font-medium',
    };
  }

  if (grade.scoreDisplay.kind === 'points') {
    const percentage =
      grade.scoreDisplay.max > 0
        ? `${((grade.scoreDisplay.value / grade.scoreDisplay.max) * 100).toFixed(0)}%`
        : null;

    return {
      primary: `${grade.scoreDisplay.value}/${grade.scoreDisplay.max}`,
      secondary: percentage,
      className: 'text-3xl font-medium',
    };
  }

  return assertNever(grade.scoreDisplay);
};

const rubricScoreLabel = (item: Grade['rubricBreakdown'][number]) =>
  item.scale === 'ielts_band'
    ? `${formatBandScore(item.points)} / ${formatBandScore(item.maxPoints)}`
    : `${item.points}/${item.maxPoints}`;

const rubricProgressValue = (item: Grade['rubricBreakdown'][number]) =>
  item.maxPoints > 0 ? (item.points / item.maxPoints) * 100 : 0;

const explanationText = (explanation: Record<string, unknown> | undefined) => {
  if (!explanation) {
    return '';
  }

  const preferred =
    explanation.short_explanation ??
    explanation.explanation ??
    explanation.rationale ??
    explanation.feedbackMd ??
    explanation.feedback ??
    explanation.content;

  return typeof preferred === 'string'
    ? preferred
    : JSON.stringify(explanation);
};

const renderFeedbackContent = (feedback: string) => {
  const lines = feedback.split('\n');
  const elements: React.ReactNode[] = [];
  let listItems: string[] = [];

  const flushListItems = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`list-${elements.length}`} className="space-y-2 ml-4">
          {listItems.map((item, idx) => (
            <li key={idx} className="flex items-start gap-3">
              <div className="size-1.5 rounded-full bg-primary/70 mt-2 flex-shrink-0" />
              <span className="text-sm text-foreground/90 leading-relaxed">
                {item}
              </span>
            </li>
          ))}
        </ul>,
      );
      listItems = [];
    }
  };

  lines.forEach((line, i) => {
    const trimmedLine = line.trim();

    if (trimmedLine.startsWith('# ')) {
      flushListItems();
      const title = trimmedLine.replace('# ', '');
      elements.push(
        <div key={i} className="pt-2 first:pt-0">
          <h3 className="text-lg font-semibold text-foreground mb-2 flex items-center gap-2">
            <Award className="size-5 text-primary" />
            {title}
          </h3>
        </div>,
      );
    } else if (trimmedLine.startsWith('## ')) {
      flushListItems();
      const subtitle = trimmedLine.replace('## ', '');
      elements.push(
        <div key={i} className="pt-3">
          <h4 className="text-base font-medium text-foreground/90 mb-2 pl-3 border-l-2 border-primary/40">
            {subtitle}
          </h4>
        </div>,
      );
    } else if (trimmedLine.startsWith('- ')) {
      listItems.push(trimmedLine.replace('- ', ''));
    } else if (trimmedLine) {
      flushListItems();
      elements.push(
        <p key={i} className="text-sm text-foreground/80 leading-relaxed">
          {trimmedLine}
        </p>,
      );
    }
  });

  flushListItems();
  return elements;
};

const getObjectiveExplanationTargets = (assignment: Assignment) => {
  if (
    !isIeltsAssignmentType(assignment.type) ||
    (assignment.type !== 'reading' && assignment.type !== 'listening')
  ) {
    return [];
  }

  const config = normalizeIeltsAssignmentConfig(
    assignment.type,
    assignment.assignmentConfig,
  );

  if (config.aiPolicy.objectiveExplanations !== 'on_demand_student_visible') {
    return [];
  }

  return getStudentIeltsAnswerTargets(
    config as IeltsReadingConfig | IeltsListeningConfig,
  );
};

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
  const gradesQuery = useGradesQuery(studentSubmissions, assignments);

  if (!currentUser) return null;

  const isLoading = assignmentsLoading || gradesQuery.isLoading;
  const error = assignmentsError ?? gradesQuery.error;

  const handleExplain = async (submission: Submission, questionId: string) => {
    const key = explanationKey(submission.id, questionId);
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
              const explanationTargets =
                getObjectiveExplanationTargets(assignment);
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
                                      disabled={active || Boolean(ready)}
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
