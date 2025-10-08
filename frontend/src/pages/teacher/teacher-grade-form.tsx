import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { PageHeader } from '../../components/page-header';
import { useRouter } from '../../lib/router';
import { mockAssignments, mockSubmissions } from '../../lib/mock-data';
import { formatDate } from '../../lib/utils';
import { toast } from 'sonner@2.0.3';
import { Download, FileText, Send } from 'lucide-react';

export function TeacherGradeForm({ submissionId }: { submissionId: string }) {
  const { navigate } = useRouter();
  const [scores, setScores] = useState({ format: 9, content: 18, clarity: 8, grammar: 9 });
  const [feedback, setFeedback] = useState('');

  const submission = mockSubmissions.find(s => s.id === submissionId);
  const assignment = submission ? mockAssignments.find(a => a.id === submission.assignmentId) : null;

  if (!submission || !assignment) return null;

  const rawScore = Object.values(scores).reduce((a, b) => a + b, 0);
  const adjustments = submission.status === 'late' ? -5 : 0;
  const finalScore = rawScore + adjustments;

  const handleSubmit = () => {
    toast.success('Grade posted successfully!');
    navigate('/teacher/submissions');
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
                {[
                  { label: 'Format & Structure', key: 'format', max: 10 },
                  { label: 'Content & Analysis', key: 'content', max: 20 },
                  { label: 'Clarity & Professionalism', key: 'clarity', max: 10 },
                  { label: 'Grammar & Mechanics', key: 'grammar', max: 10 },
                ].map(criteria => (
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

            <Button className="w-full" size="lg" onClick={handleSubmit}>
              <Send className="mr-2 size-4" />
              Post Grade
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

