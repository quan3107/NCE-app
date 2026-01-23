/**
 * Location: features/assignments/components/StudentAssignmentDetailPage.tsx
 * Purpose: Render the Student Assignment Detail Page component for the Assignments domain.
 * Why: Keeps the feature module organized under the new structure.
 */

import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@components/ui/card';
import { Button } from '@components/ui/button';
import { Badge } from '@components/ui/badge';
import { Label } from '@components/ui/label';
import { Alert, AlertDescription } from '@components/ui/alert';
import { PageHeader } from '@components/common/PageHeader';
import { useAuthStore } from '@store/authStore';
import { useRouter } from '@lib/router';
import { Clock, FileText, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { formatDate, formatFileSize } from '@lib/utils';
import { toast } from 'sonner@2.0.3';
import type { Submission, SubmissionFile } from '@lib/mock-data';
import { useAssignmentResources, useCreateSubmissionMutation } from '@features/assignments/api';
import { StudentAssignmentSubmitDialog } from '@features/assignments/components/StudentAssignmentSubmitDialog';
import { StudentAssignmentSidebar } from '@features/assignments/components/StudentAssignmentSidebar';

export function StudentAssignmentDetailPage({ assignmentId }: { assignmentId: string }) {
  const { currentUser } = useAuthStore();
  const { navigate } = useRouter();
  const { assignments, submissions, isLoading, error } = useAssignmentResources();
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [submissionContent, setSubmissionContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadBusy, setIsUploadBusy] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<SubmissionFile[]>([]);
  const [localSubmission, setLocalSubmission] = useState<Submission | null>(null);
  const createSubmissionMutation = useCreateSubmissionMutation();

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Loading assignment...
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
            <p className="text-destructive font-medium">Unable to load the assignment.</p>
            <p className="text-sm text-muted-foreground mt-2">{error.message}</p>
          </CardContent>
        </Card>
      </div>
    );
  }
  const assignment = assignments.find(a => a.id === assignmentId);
  const submission = useMemo(
    () =>
      submissions.find(
        (item) => item.assignmentId === assignmentId && item.studentId === currentUser?.id,
      ) ?? localSubmission,
    [assignmentId, currentUser?.id, localSubmission, submissions],
  );
  if (!assignment) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Assignment not found</p>
          <Button onClick={() => navigate('/student/assignments')}>Back to Assignments</Button>
        </div>
      </div>
    );
  }
  const dueDate = new Date(assignment.dueAt);
  const now = new Date();
  const isOverdue = dueDate < now && !submission;
  const hoursUntilDue = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60);
  const isDueSoon = hoursUntilDue <= 48 && hoursUntilDue > 0;
  const handleSubmit = async () => {
    if (!currentUser?.id) {
      toast.error('Unable to submit without a student account.');
      return;
    }

    if ((assignment.type === 'text' || assignment.type === 'link') && !submissionContent.trim()) {
      toast.error('Please add your submission before sending.');
      return;
    }

    if (assignment.type === 'file' && uploadedFiles.length === 0) {
      toast.error('Please upload at least one file before submitting.');
      return;
    }
    setIsSubmitting(true);

    const payloadRecord: Record<string, unknown> = {
      studentName: currentUser.name || 'Student',
    };

    if (assignment.type === 'text') {
      payloadRecord.content = submissionContent.trim();
    }
    if (assignment.type === 'link') {
      payloadRecord.link = submissionContent.trim();
    }
    if (uploadedFiles.length > 0) {
      payloadRecord.files = uploadedFiles;
    }

    try {
      const response = await createSubmissionMutation.mutateAsync({
        assignmentId,
        payload: {
          studentId: currentUser.id,
          payload: payloadRecord,
          submittedAt: new Date().toISOString(),
          status: isOverdue ? 'late' : 'submitted',
        },
      });

      const nextSubmission: Submission = {
        id: response.id,
        assignmentId: response.assignmentId,
        studentId: response.studentId,
        studentName: currentUser.name || 'Student',
        status: response.status,
        submittedAt: response.submittedAt ? new Date(response.submittedAt) : new Date(),
        content: typeof payloadRecord.content === 'string' ? payloadRecord.content : undefined,
        files: Array.isArray(payloadRecord.files)
          ? (payloadRecord.files as SubmissionFile[])
          : undefined,
        version: 1,
      };

      setLocalSubmission(nextSubmission);
      setSubmissionContent('');
      setUploadedFiles([]);
      setIsUploadBusy(false);
      toast.success('Assignment submitted successfully!');
      setShowSubmitDialog(false);
      navigate('/student/assignments');
    } catch (errorValue) {
      toast.error(
        errorValue instanceof Error ? errorValue.message : 'Unable to submit assignment.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title={assignment.title}
        description={assignment.courseName}
        showBack
        breadcrumbs={[
          { label: 'Assignments', path: '/student/assignments' },
          { label: assignment.title },
        ]}
        actions={
          !submission ? (
            <Button onClick={() => setShowSubmitDialog(true)} disabled={isOverdue}>
              {isOverdue ? 'Past Due' : 'Submit Assignment'}
            </Button>
          ) : (
            <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-200">
              <CheckCircle2 className="size-4 mr-2" />
              {submission.status === 'graded' ? 'Graded' : 'Submitted'}
            </Badge>
          )
        }
      />
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Status Alert */}
          {isOverdue && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>
                This assignment was due on {formatDate(dueDate, 'datetime')}. {assignment.latePolicy}
              </AlertDescription>
            </Alert>
          )}
          {isDueSoon && !submission && (
            <Alert>
              <Clock className="size-4" />
              <AlertDescription>
                This assignment is due soon: {formatDate(dueDate, 'datetime')}
              </AlertDescription>
            </Alert>
          )}
          {submission && (
            <Alert className="bg-green-500/10 border-green-200">
              <CheckCircle2 className="size-4 text-green-700" />
              <AlertDescription className="text-green-700">
                Submitted on {formatDate(new Date(submission.submittedAt!), 'datetime')}
                {submission.version > 1 && ` (Version ${submission.version})`}
              </AlertDescription>
            </Alert>
          )}
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Assignment Details */}
              <Card>
                <CardHeader>
                  <CardTitle>Assignment Description</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-sm max-w-none">
                    {assignment.description.split('\n').map((line, i) => {
                      if (line.startsWith('# ')) {
                        return <h2 key={i}>{line.replace('# ', '')}</h2>;
                      } else if (line.startsWith('## ')) {
                        return <h3 key={i}>{line.replace('## ', '')}</h3>;
                      } else if (line.startsWith('- ')) {
                        return <li key={i}>{line.replace('- ', '')}</li>;
                      } else if (line) {
                        return <p key={i}>{line}</p>;
                      }
                      return null;
                    })}
                  </div>
                </CardContent>
              </Card>
              {/* Submission History */}
              {submission && (
                <Card>
                  <CardHeader>
                    <CardTitle>Your Submission</CardTitle>
                    <CardDescription>Submitted work and history</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="p-4 bg-muted/50 rounded-lg">
                      {submission.content && (
                        <div>
                          <Label>Content</Label>
                          <p className="mt-2 text-sm">{submission.content}</p>
                        </div>
                      )}
                      {submission.files && submission.files.length > 0 && (
                        <div>
                          <Label>Files</Label>
                          <div className="mt-2 space-y-2">
                            {submission.files.map((file) => (
                              <div key={file.id} className="flex items-center gap-2 text-sm">
                                <FileText className="size-4 text-muted-foreground" />
                                <div>
                                  <p className="font-medium">{file.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {formatFileSize(file.size)} · {file.mime}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Info className="size-4" />
                      <span>
                        Submitted {formatDate(new Date(submission.submittedAt!), 'datetime')} · Version {submission.version}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
            <StudentAssignmentSidebar
              assignment={assignment}
              dueDate={dueDate}
              isOverdue={isOverdue}
              onViewAssignments={() => navigate('/student/assignments')}
            />
          </div>
        </div>
      </div>
      <StudentAssignmentSubmitDialog
        assignment={assignment}
        isOpen={showSubmitDialog}
        isSubmitting={isSubmitting}
        isUploadBusy={isUploadBusy}
        submissionContent={submissionContent}
        uploadedFiles={uploadedFiles}
        onOpenChange={setShowSubmitDialog}
        onSubmissionContentChange={setSubmissionContent}
        onUploadedFilesChange={setUploadedFiles}
        onUploadBusyChange={setIsUploadBusy}
        onSubmit={handleSubmit}
      />
    </div>
  );
}

