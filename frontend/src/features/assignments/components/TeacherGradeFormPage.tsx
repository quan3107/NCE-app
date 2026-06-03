/**
 * Location: features/assignments/components/TeacherGradeFormPage.tsx
 * Purpose: Render the Teacher Grade Form Page component for the Assignments domain.
 * Why: Keeps data lookup and grade submission flow near the route while panels live separately.
 */

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@components/ui/card';
import { PageHeader } from '@components/common/PageHeader';
import { useRouter } from '@lib/router';
import { toast } from 'sonner@2.0.3';
import { useAssignmentResources, markSubmissionAsGraded } from '@features/assignments/api';
import { useUpsertGradeMutation } from '@features/grades/api';
import { useCourseRubricsQuery } from '@features/rubrics/api';
import { useAuthStore } from '@store/authStore';
import { TeacherGradePanels } from './TeacherGradePanels';
import {
  calculateRawScore,
  getAssignmentRubricIds,
  getIeltsManualGradeCriteria,
  isValidIeltsBandScore,
  toGradeCriteria,
} from './teacherGrade.logic';

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
  const ieltsGradeCriteria = useMemo(
    () => getIeltsManualGradeCriteria(assignment?.type),
    [assignment?.type],
  );
  const ieltsGradingMode = ieltsGradeCriteria.length > 0;
  const gradeCriteria = useMemo(
    () =>
      ieltsGradingMode
        ? ieltsGradeCriteria
        : selectedRubric
          ? toGradeCriteria(selectedRubric.criteria)
          : [],
    [ieltsGradeCriteria, ieltsGradingMode, selectedRubric],
  );
  const rubricDrivenMode = gradeCriteria.length > 0 && (ieltsGradingMode || selectedRubric !== null);

  useEffect(() => {
    if (!rubricDrivenMode) {
      return;
    }
    setScores(Object.fromEntries(gradeCriteria.map((criterion) => [criterion.key, 0])));
  }, [gradeCriteria, rubricDrivenMode]);

  useEffect(() => {
    setRawScoreInput(0);
  }, [assignment?.id]);

  if (isLoading) {
    return <StatusCard message="Loading submission..." />;
  }

  if (error) {
    return <StatusCard title="Unable to load the submission." message={error.message} destructive />;
  }

  if (!submission || !assignment) {
    return null;
  }

  const rawScore = calculateRawScore(
    rubricDrivenMode,
    gradeCriteria,
    scores,
    rawScoreInput,
    ieltsGradingMode ? 'ieltsBand' : 'sum',
  );
  const adjustments = ieltsGradingMode ? 0 : submission.status === 'late' ? -5 : 0;
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
    if (
      ieltsGradingMode &&
      !gradeCriteria.every((criterion) => isValidIeltsBandScore(scores[criterion.key] ?? 0))
    ) {
      toast.error('IELTS criteria must use bands from 0 to 9 in 0.5 increments.');
      return;
    }

    const rubricBreakdown = rubricDrivenMode
      ? gradeCriteria.map((criterion) => ({
          criterion: criterion.payloadCriterion ?? criterion.label,
          points: scores[criterion.key] ?? 0,
        }))
      : undefined;
    const adjustmentsList =
      adjustments !== 0 ? [{ reason: 'Late submission', delta: adjustments }] : undefined;

    try {
      await upsertGradeMutation.mutateAsync({
        submissionId,
        payload: {
          rubricBreakdown,
          rawScore,
          adjustments: adjustmentsList,
          finalScore,
          band: ieltsGradingMode ? finalScore : undefined,
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
      <TeacherGradePanels
        adjustments={adjustments}
        assignment={assignment}
        feedback={feedback}
        finalScore={finalScore}
        gradeCriteria={gradeCriteria}
        ieltsGradingMode={ieltsGradingMode}
        isPosting={upsertGradeMutation.isPending}
        onFeedbackChange={setFeedback}
        onPostGrade={handleSubmit}
        onRawScoreChange={setRawScoreInput}
        onScoreChange={(criterionKey, score) =>
          setScores((current) => ({ ...current, [criterionKey]: score }))
        }
        rawScore={rawScore}
        rawScoreInput={rawScoreInput}
        rubricDrivenMode={rubricDrivenMode}
        rubricIds={rubricIds}
        rubricIsLoading={rubricsQuery.isLoading}
        scores={scores}
        submission={submission}
      />
    </div>
  );
}

function StatusCard({
  destructive = false,
  message,
  title,
}: {
  destructive?: boolean;
  message: string;
  title?: string;
}) {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <Card>
        <CardContent className="py-12 text-center">
          {title && (
            <p className={destructive ? 'text-destructive font-medium' : 'font-medium'}>{title}</p>
          )}
          <p className="text-sm text-muted-foreground mt-2">{message}</p>
        </CardContent>
      </Card>
    </div>
  );
}
