/**
 * Location: features/assignments/components/TeacherGradePanels.tsx
 * Purpose: Render teacher grading panels for submission, rubric, feedback, and summary.
 * Why: Keeps TeacherGradeFormPage focused on data lookup and submit behavior.
 */

import { FileText, Send } from 'lucide-react';
import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/card';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { Textarea } from '@components/ui/textarea';
import { formatDate } from '@lib/utils';
import type { Assignment, Submission } from '@domain';
import { FileDownloadButton } from '@features/files/FileDownloadButton';
import type { GradeCriterion } from './teacherGrade.logic';

type TeacherGradePanelsProps = {
  adjustments: number;
  assignment: Assignment;
  feedback: string;
  finalScore: number;
  gradeCriteria: GradeCriterion[];
  ieltsGradingMode: boolean;
  isPosting: boolean;
  onFeedbackChange: (feedback: string) => void;
  onPostGrade: () => void;
  onRawScoreChange: (score: number) => void;
  onScoreChange: (criterionKey: string, score: number) => void;
  rawScore: number;
  rawScoreInput: number;
  rubricDrivenMode: boolean;
  rubricIds: string[];
  rubricIsLoading: boolean;
  scores: Record<string, number>;
  submission: Submission;
};

export function TeacherGradePanels({
  adjustments,
  assignment,
  feedback,
  finalScore,
  gradeCriteria,
  ieltsGradingMode,
  isPosting,
  onFeedbackChange,
  onPostGrade,
  onRawScoreChange,
  onScoreChange,
  rawScore,
  rawScoreInput,
  rubricDrivenMode,
  rubricIds,
  rubricIsLoading,
  scores,
  submission,
}: TeacherGradePanelsProps) {
  const finalPercentage =
    !ieltsGradingMode && assignment.maxScore > 0
      ? `${((finalScore / assignment.maxScore) * 100).toFixed(0)}%`
      : 'N/A';

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-5xl mx-auto grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <StudentSubmissionPanel submission={submission} />
          <RubricPanel
            assignment={assignment}
            gradeCriteria={gradeCriteria}
            ieltsGradingMode={ieltsGradingMode}
            onRawScoreChange={onRawScoreChange}
            onScoreChange={onScoreChange}
            rawScoreInput={rawScoreInput}
            rubricDrivenMode={rubricDrivenMode}
            rubricIds={rubricIds}
            rubricIsLoading={rubricIsLoading}
            scores={scores}
          />
          <FeedbackPanel feedback={feedback} onFeedbackChange={onFeedbackChange} />
        </div>

        <div className="space-y-6">
          <GradeSummaryPanel
            adjustments={adjustments}
            assignment={assignment}
            finalPercentage={finalPercentage}
            finalScore={finalScore}
            ieltsGradingMode={ieltsGradingMode}
            rawScore={rawScore}
          />
          <SubmissionInfoPanel submission={submission} />
          <Button className="w-full" size="lg" onClick={onPostGrade} disabled={isPosting}>
            <Send className="mr-2 size-4" />
            {isPosting ? 'Posting...' : 'Post Grade'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function StudentSubmissionPanel({ submission }: { submission: Submission }) {
  return (
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
        {submission.files?.map((file) => (
          <div key={file.id} className="flex items-center gap-2 p-3 border rounded-lg">
            <FileText className="size-5 text-muted-foreground" />
            <span className="flex-1">{file.name}</span>
            <FileDownloadButton file={file} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function RubricPanel({
  assignment,
  gradeCriteria,
  ieltsGradingMode,
  onRawScoreChange,
  onScoreChange,
  rawScoreInput,
  rubricDrivenMode,
  rubricIds,
  rubricIsLoading,
  scores,
}: Pick<
  TeacherGradePanelsProps,
  | 'assignment'
  | 'gradeCriteria'
  | 'ieltsGradingMode'
  | 'onRawScoreChange'
  | 'onScoreChange'
  | 'rawScoreInput'
  | 'rubricDrivenMode'
  | 'rubricIds'
  | 'rubricIsLoading'
  | 'scores'
>) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Rubric</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {rubricIsLoading && rubricIds.length > 0 ? (
          <p className="text-sm text-muted-foreground">Loading rubric criteria...</p>
        ) : rubricDrivenMode ? (
          gradeCriteria.map((criterion) => (
            <div key={criterion.key} className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{criterion.label}</Label>
                <span className="text-sm text-muted-foreground">
                  {ieltsGradingMode ? 'Band' : `/ ${criterion.max}`}
                </span>
              </div>
              <Input
                type="number"
                min="0"
                max={criterion.max}
                step={criterion.step ?? 1}
                value={scores[criterion.key] ?? 0}
                onChange={(event) => {
                  const nextValue = parseFloat(event.target.value);
                  onScoreChange(criterion.key, Number.isNaN(nextValue) ? 0 : nextValue);
                }}
              />
              {ieltsGradingMode && (
                <p className="text-xs text-muted-foreground">
                  Use IELTS bands from 0 to 9 in 0.5 increments.
                </p>
              )}
            </div>
          ))
        ) : (
          <FreeformGradePanel
            assignment={assignment}
            onRawScoreChange={onRawScoreChange}
            rawScoreInput={rawScoreInput}
            rubricIds={rubricIds}
          />
        )}
      </CardContent>
    </Card>
  );
}

function FreeformGradePanel({
  assignment,
  onRawScoreChange,
  rawScoreInput,
  rubricIds,
}: Pick<TeacherGradePanelsProps, 'assignment' | 'onRawScoreChange' | 'rawScoreInput' | 'rubricIds'>) {
  const fallbackMessage =
    rubricIds.length === 0
      ? 'No rubric is linked to this assignment. Freeform grading is enabled.'
      : rubricIds.length > 1
        ? 'This assignment uses multiple rubric references. Freeform grading is enabled.'
        : 'Linked rubric could not be loaded. Freeform grading is enabled.';

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <p className="text-sm text-muted-foreground">{fallbackMessage}</p>
      <div className="space-y-2">
        <Label>Raw Score</Label>
        <Input
          type="number"
          min="0"
          max={assignment.maxScore}
          value={rawScoreInput}
          onChange={(event) => {
            const nextValue = parseFloat(event.target.value);
            onRawScoreChange(Number.isNaN(nextValue) ? 0 : nextValue);
          }}
        />
        <p className="text-xs text-muted-foreground">Max assignment score: {assignment.maxScore}</p>
      </div>
    </div>
  );
}

function FeedbackPanel({
  feedback,
  onFeedbackChange,
}: Pick<TeacherGradePanelsProps, 'feedback' | 'onFeedbackChange'>) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Feedback</CardTitle>
      </CardHeader>
      <CardContent>
        <Textarea
          rows={8}
          placeholder="Provide detailed feedback to the student..."
          value={feedback}
          onChange={(event) => onFeedbackChange(event.target.value)}
        />
      </CardContent>
    </Card>
  );
}

function GradeSummaryPanel({
  adjustments,
  assignment,
  finalPercentage,
  finalScore,
  ieltsGradingMode,
  rawScore,
}: Pick<
  TeacherGradePanelsProps,
  'adjustments' | 'assignment' | 'finalScore' | 'ieltsGradingMode' | 'rawScore'
> & {
  finalPercentage: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Grade Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-between">
          <span className="text-muted-foreground">
            {ieltsGradingMode ? 'Average Band' : 'Raw Score'}
          </span>
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
          <span className="text-3xl font-medium">
            {ieltsGradingMode ? `Band ${finalScore}` : `${finalScore}/${assignment.maxScore}`}
          </span>
        </div>
        {!ieltsGradingMode && (
          <div className="text-center">
            <div className="text-2xl font-medium text-muted-foreground">{finalPercentage}</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SubmissionInfoPanel({ submission }: { submission: Submission }) {
  return (
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
          <Badge
            variant={submission.status === 'late' ? 'destructive' : 'secondary'}
            className="capitalize"
          >
            {submission.status}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
