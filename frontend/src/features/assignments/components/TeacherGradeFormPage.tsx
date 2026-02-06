/**
 * Location: features/assignments/components/TeacherGradeFormPage.tsx
 * Purpose: Render the Teacher Grade Form Page component for the Assignments domain.
 * Why: Keeps the feature module organized under the new structure.
 */

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/card';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { Textarea } from '@components/ui/textarea';
import { Label } from '@components/ui/label';
import { Badge } from '@components/ui/badge';
import { PageHeader } from '@components/common/PageHeader';
import { useRouter } from '@lib/router';
import { formatDate } from '@lib/utils';
import { toast } from 'sonner@2.0.3';
import { Download, FileText, Send } from 'lucide-react';
import { useAssignmentResources, markSubmissionAsGraded } from '@features/assignments/api';
import { useUpsertGradeMutation } from '@features/grades/api';
import { useCourseRubricsQuery } from '@features/rubrics/api';
import { useAuthStore } from '@store/authStore';

type GradeCriterion = {
  key: string;
  label: string;
  max: number;
};

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const getAssignmentRubricIds = (assignmentConfig: Record<string, unknown> | null | undefined): string[] => {
  const config = asRecord(assignmentConfig);
  if (!config) {
    return [];
  }

  const rubricIds = new Set<string>();
  const task1 = asRecord(config.task1);
  const task2 = asRecord(config.task2);

  if (typeof task1?.rubricId === 'string' && task1.rubricId.length > 0) {
    rubricIds.add(task1.rubricId);
  }
  if (typeof task2?.rubricId === 'string' && task2.rubricId.length > 0) {
    rubricIds.add(task2.rubricId);
  }
  if (typeof config.rubricId === 'string' && config.rubricId.length > 0) {
    rubricIds.add(config.rubricId);
  }

  return Array.from(rubricIds);
};

const toGradeCriteria = (criteria: Array<{ criterion: string; levels: Array<{ points: number }> }>): GradeCriterion[] => {
  return criteria.map((criterion, index) => ({
    key: `${index}`,
    label: criterion.criterion,
    max: criterion.levels.length > 0 ? Math.max(...criterion.levels.map((level) => level.points)) : 100,
  }));
};

export function TeacherGradeFormPage({ submissionId }: { submissionId: string }) {
  const { currentUser } = useAuthStore();
  const { navigate } = useRouter();
  const [scores, setScores] = useState<Record<string, number>>({});
  const [rawScoreInput, setRawScoreInput] = useState(0);
  const [feedback, setFeedback] = useState('');
  const { submissions, assignments, isLoading, error } = useAssignmentResources();
  const upsertGradeMutation = useUpsertGradeMutation();

  const submission = submissions.find((item) => item.id === submissionId);
  const assignment = submission
    ? assignments.find((item) => item.id === submission.assignmentId)
    : null;

  const rubricsQuery = useCourseRubricsQuery(assignment?.courseId ?? '');

  const rubricIds = useMemo(
    () => getAssignmentRubricIds(assignment?.assignmentConfig ?? null),
    [assignment?.assignmentConfig],
  );

  const selectedRubric = useMemo(() => {
    if (rubricIds.length !== 1) {
      return null;
    }

    return (rubricsQuery.data ?? []).find((rubric) => rubric.id === rubricIds[0]) ?? null;
  }, [rubricsQuery.data, rubricIds]);

  const gradeCriteria = useMemo(
    () => (selectedRubric ? toGradeCriteria(selectedRubric.criteria) : []),
    [selectedRubric],
  );

  const rubricDrivenMode = selectedRubric !== null && gradeCriteria.length > 0;

  useEffect(() => {
    if (!rubricDrivenMode) {
      return;
    }

    const initialScores = Object.fromEntries(
      gradeCriteria.map((criterion) => [criterion.key, 0]),
    );
    setScores(initialScores);
  }, [gradeCriteria, rubricDrivenMode]);

  useEffect(() => {
    setRawScoreInput(0);
  }, [assignment?.id]);

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Loading submission...
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-destructive font-medium">Unable to load the submission.</p>
            <p className="text-sm text-muted-foreground mt-2">{error.message}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!submission || !assignment) {
    return null;
  }

  const rawScore = rubricDrivenMode
    ? gradeCriteria.reduce((sum, criterion) => sum + (scores[criterion.key] ?? 0), 0)
    : rawScoreInput;
  const adjustments = submission.status === 'late' ? -5 : 0;
  const finalScore = rawScore + adjustments;

  const handleSubmit = async () => {
    if (!currentUser.id) {
      toast.error('Unable to grade without a teacher account.');
      return;
    }

    if (!Number.isFinite(rawScore) || rawScore < 0) {
      toast.error('Raw score must be a valid non-negative number.');
      return;
    }

    const rubricBreakdown = rubricDrivenMode
      ? gradeCriteria.map((criterion) => ({
          criterion: criterion.label,
          points: scores[criterion.key] ?? 0,
        }))
      : undefined;

    const adjustmentsList = adjustments !== 0 ? [{ reason: 'Late submission', delta: adjustments }] : undefined;

    try {
      await upsertGradeMutation.mutateAsync({
        submissionId,
        payload: {
          graderId: currentUser.id,
          rubricBreakdown,
          rawScore,
          adjustments: adjustmentsList,
          finalScore,
          feedbackMd: feedback.trim() || undefined,
        },
      });
      markSubmissionAsGraded(submissionId);
      toast.success('Grade posted successfully!');
      navigate('/teacher/submissions');
    } catch (errorValue) {
      toast.error(errorValue instanceof Error ? errorValue.message : 'Unable to post grade.');
    }
  };

  return (
    <div>
      <PageHeader
        title="Grade Submission"
        description={`${assignment.title} - ${submission.studentName}`}
        showBack
      />
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-5xl mx-auto grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Student Submission</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {submission.content && (
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm whitespace-pre-wrap">{submission.content}</p>
                  </div>
                )}
                {submission.files && submission.files.map((file) => (
                  <div key={file.id} className="flex items-center gap-2 p-3 border rounded-lg">
                    <FileText className="size-5 text-muted-foreground" />
                    <span className="flex-1">{file.name}</span>
                    <Button variant="ghost" size="sm">
                      <Download className="size-4" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Rubric</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {rubricsQuery.isLoading && rubricIds.length > 0 ? (
                  <p className="text-sm text-muted-foreground">Loading rubric criteria...</p>
                ) : rubricDrivenMode ? (
                  gradeCriteria.map((criterion) => (
                    <div key={criterion.key} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>{criterion.label}</Label>
                        <span className="text-sm text-muted-foreground">/ {criterion.max}</span>
                      </div>
                      <Input
                        type="number"
                        min="0"
                        max={criterion.max}
                        value={scores[criterion.key] ?? 0}
                        onChange={(event) => {
                          const nextValue = parseInt(event.target.value, 10);
                          setScores((current) => ({
                            ...current,
                            [criterion.key]: Number.isNaN(nextValue) ? 0 : nextValue,
                          }));
                        }}
                      />
                    </div>
                  ))
                ) : (
                  <div className="space-y-4 rounded-lg border p-4">
                    <p className="text-sm text-muted-foreground">
                      {rubricIds.length === 0
                        ? 'No rubric is linked to this assignment. Freeform grading is enabled.'
                        : rubricIds.length > 1
                          ? 'This assignment uses multiple rubric references. Freeform grading is enabled.'
                          : 'Linked rubric could not be loaded. Freeform grading is enabled.'}
                    </p>
                    <div className="space-y-2">
                      <Label>Raw Score</Label>
                      <Input
                        type="number"
                        min="0"
                        max={assignment.maxScore}
                        value={rawScoreInput}
                        onChange={(event) => {
                          const nextValue = parseFloat(event.target.value);
                          setRawScoreInput(Number.isNaN(nextValue) ? 0 : nextValue);
                        }}
                      />
                      <p className="text-xs text-muted-foreground">
                        Max assignment score: {assignment.maxScore}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Feedback</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  rows={8}
                  placeholder="Provide detailed feedback to the student..."
                  value={feedback}
                  onChange={(event) => setFeedback(event.target.value)}
                />
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Grade Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Raw Score</span>
                  <span className="font-medium">{rawScore}</span>
                </div>
                {adjustments !== 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Late Penalty</span>
                    <span className="font-medium text-red-600">{adjustments}</span>
                  </div>
                )}
                <div className="pt-4 border-t flex justify-between items-center">
                  <span className="font-medium">Final Score</span>
                  <span className="text-3xl font-medium">{finalScore}/{assignment.maxScore}</span>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-medium text-muted-foreground">
                    {assignment.maxScore > 0
                      ? `${((finalScore / assignment.maxScore) * 100).toFixed(0)}%`
                      : 'N/A'}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Submission Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Student</span>
                  <span className="font-medium">{submission.studentName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Submitted</span>
                  <span className="font-medium">{formatDate(new Date(submission.submittedAt!))}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <Badge variant={submission.status === 'late' ? 'destructive' : 'secondary'} className="capitalize">
                    {submission.status}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Button
              className="w-full"
              size="lg"
              onClick={handleSubmit}
              disabled={upsertGradeMutation.isPending}
            >
              <Send className="mr-2 size-4" />
              {upsertGradeMutation.isPending ? 'Posting...' : 'Post Grade'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
