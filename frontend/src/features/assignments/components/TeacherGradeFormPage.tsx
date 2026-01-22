/**
 * Location: features/assignments/components/TeacherGradeFormPage.tsx
 * Purpose: Render the Teacher Grade Form Page component for the Assignments domain.
 * Why: Keeps the feature module organized under the new structure.
 */

import { useState } from 'react';
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
import { useAuthStore } from '@store/authStore';

const RUBRIC_CRITERIA = [
  { label: 'Format & Structure', key: 'format', max: 10 },
  { label: 'Content & Analysis', key: 'content', max: 20 },
  { label: 'Clarity & Professionalism', key: 'clarity', max: 10 },
  { label: 'Grammar & Mechanics', key: 'grammar', max: 10 },
] as const;

export function TeacherGradeFormPage({ submissionId }: { submissionId: string }) {
  const { currentUser } = useAuthStore();
  const { navigate } = useRouter();
  const [scores, setScores] = useState({ format: 9, content: 18, clarity: 8, grammar: 9 });
  const [feedback, setFeedback] = useState('');
  const { submissions, assignments, isLoading, error } = useAssignmentResources();
  const upsertGradeMutation = useUpsertGradeMutation();

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

  const submission = submissions.find(s => s.id === submissionId);
  const assignment = submission ? assignments.find(a => a.id === submission.assignmentId) : null;

  if (!submission || !assignment) return null;

  const rawScore = Object.values(scores).reduce((a, b) => a + b, 0);
  const adjustments = submission.status === 'late' ? -5 : 0;
  const finalScore = rawScore + adjustments;

  const handleSubmit = async () => {
    if (!currentUser.id) {
      toast.error('Unable to grade without a teacher account.');
      return;
    }

    const rubricBreakdown = RUBRIC_CRITERIA.map((criteria) => ({
      criterion: criteria.label,
      points: scores[criteria.key],
    }));

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
            {/* Student Work */}
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
                {submission.files && submission.files.map((file, i) => (
                  <div key={i} className="flex items-center gap-2 p-3 border rounded-lg">
                    <FileText className="size-5 text-muted-foreground" />
                    <span className="flex-1">{file}</span>
                    <Button variant="ghost" size="sm">
                      <Download className="size-4" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Rubric */}
            <Card>
              <CardHeader>
                <CardTitle>Rubric</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {RUBRIC_CRITERIA.map(criteria => (
                  <div key={criteria.key} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>{criteria.label}</Label>
                      <span className="text-sm text-muted-foreground">/ {criteria.max}</span>
                    </div>
                    <Input
                      type="number"
                      min="0"
                      max={criteria.max}
                      value={scores[criteria.key as keyof typeof scores]}
                      onChange={(e) => setScores({ ...scores, [criteria.key]: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Feedback */}
            <Card>
              <CardHeader>
                <CardTitle>Feedback</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  rows={8}
                  placeholder="Provide detailed feedback to the student..."
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                />
              </CardContent>
            </Card>
          </div>

          {/* Score Summary */}
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
                    {((finalScore / assignment.maxScore) * 100).toFixed(0)}%
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
              disabled={upsertGradeMutation.isLoading}
            >
              <Send className="mr-2 size-4" />
              {upsertGradeMutation.isLoading ? 'Posting...' : 'Post Grade'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}


