/**
 * Location: features/assignments/components/StudentAssignmentDetailPage.tsx
 * Purpose: Render the Student Assignment Detail Page component for the Assignments domain.
 * Why: Keeps the feature module organized under the new structure.
 */

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@components/ui/card';
import { Button } from '@components/ui/button';
import { PageHeader } from '@components/common/PageHeader';
import { useAuthStore } from '@store/authStore';
import { useRouter } from '@lib/router';
import { toast } from 'sonner@2.0.3';
import type { Submission, SubmissionFile } from '@domain';
import { useAssignmentResources, useCreateSubmissionMutation } from '@features/assignments/api';
import { StudentAssignmentSubmitDialog } from '@features/assignments/components/StudentAssignmentSubmitDialog';
import { StudentAssignmentSidebar } from '@features/assignments/components/StudentAssignmentSidebar';
import { StudentAssignmentDescriptionCard } from '@features/assignments/components/StudentAssignmentDescriptionCard';
import { StudentAssignmentHeaderActions } from '@features/assignments/components/StudentAssignmentHeaderActions';
import { StudentAssignmentStatusAlerts } from '@features/assignments/components/StudentAssignmentStatusAlerts';
import { StudentAssignmentSubmissionSummary } from '@features/assignments/components/StudentAssignmentSubmissionSummary';
import {
  isIeltsAssignmentType,
  normalizeIeltsAssignmentConfig,
} from '@lib/ielts';
import {
  buildStudentIeltsPayload,
  createInitialStudentIeltsAttempt,
  getStudentIeltsAttemptAvailability,
  hasStudentIeltsSubmissionContent,
} from '@features/assignments/components/ielts/student/studentIeltsAttempt.logic';
import { createStudentIeltsAttemptFromPayload } from '@features/assignments/components/ielts/student/studentIeltsAttemptHydration';

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
  const [ieltsAttempt, setIeltsAttempt] = useState(() => createInitialStudentIeltsAttempt());
  const createSubmissionMutation = useCreateSubmissionMutation();
  const assignment = assignments.find(a => a.id === assignmentId);
  const submission = useMemo(
    () =>
      submissions.find(
        (item) => item.assignmentId === assignmentId && item.studentId === currentUser?.id,
      ) ?? localSubmission,
    [assignmentId, currentUser?.id, localSubmission, submissions],
  );
  const ieltsType =
    assignment && isIeltsAssignmentType(assignment.type) ? assignment.type : undefined;
  const ieltsConfig = ieltsType
    ? normalizeIeltsAssignmentConfig(ieltsType, assignment?.assignmentConfig)
    : null;
  const attemptAvailability = ieltsConfig
    ? getStudentIeltsAttemptAvailability({
        config: ieltsConfig,
        existingVersion: submission?.version,
        existingStatus: submission?.status,
      })
    : null;
  const hasReachedMaxAttempts = Boolean(attemptAvailability?.hasReachedMaxAttempts);

  useEffect(() => {
    if (!showSubmitDialog || !ieltsType) {
      return;
    }
    if (submission?.status === 'draft' && submission.rawPayload) {
      setIeltsAttempt(createStudentIeltsAttemptFromPayload(ieltsType, submission.rawPayload));
      return;
    }
    setIeltsAttempt(createInitialStudentIeltsAttempt());
  }, [
    assignmentId,
    ieltsType,
    showSubmitDialog,
    submission?.id,
    submission?.rawPayload,
    submission?.status,
  ]);

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
  const canResubmit = Boolean(submission && submission.status !== 'graded' && !hasReachedMaxAttempts);

  const submitAssignment = async (mode: 'draft' | 'submitted') => {
    if (!currentUser?.id) {
      toast.error('Unable to submit without a student account.');
      return;
    }
    if (hasReachedMaxAttempts) {
      toast.error('Maximum attempts reached for this assignment.');
      return;
    }
    if (
      !ieltsType &&
      (assignment.type === 'text' || assignment.type === 'link') &&
      !submissionContent.trim()
    ) {
      toast.error('Please add your submission before sending.');
      return;
    }
    if (!ieltsType && assignment.type === 'file' && uploadedFiles.length === 0) {
      toast.error('Please upload at least one file before submitting.');
      return;
    }
    if (
      mode === 'submitted' &&
      ieltsType &&
      ieltsConfig &&
      !hasStudentIeltsSubmissionContent(ieltsType, ieltsConfig, ieltsAttempt)
    ) {
      toast.error('Please complete the IELTS attempt before submitting.');
      return;
    }
    setIsSubmitting(true);

    try {
      const requestTime = new Date();
      const submittedAt =
        mode === 'submitted' ? requestTime.toISOString() : undefined;
      const status =
        mode === 'draft' ? 'draft' : dueDate < requestTime ? 'late' : 'submitted';
      const nextVersion =
        ieltsType && attemptAvailability
          ? attemptAvailability.nextAttempt
          : submission
            ? submission.version + 1
            : 1;
      const payloadRecord: Record<string, unknown> =
        ieltsType && ieltsConfig
          ? buildStudentIeltsPayload({
              type: ieltsType,
              config: ieltsConfig,
              attempt: nextVersion,
              state: ieltsAttempt,
              submittedAt,
            })
          : {
              studentName: currentUser.name || 'Student',
              version: nextVersion,
            };

      if (!ieltsType && assignment.type === 'text') {
        payloadRecord.content = submissionContent.trim();
      }
      if (!ieltsType && assignment.type === 'link') {
        payloadRecord.link = submissionContent.trim();
      }
      if (!ieltsType && uploadedFiles.length > 0) {
        payloadRecord.files = uploadedFiles;
      }

      const response = await createSubmissionMutation.mutateAsync({
        assignmentId,
        payload: {
          payload: payloadRecord,
          submittedAt,
          status,
        },
      });

      const responsePayload = response.payload ?? payloadRecord;
      const responseVersion =
        typeof responsePayload.version === 'number' ? responsePayload.version : nextVersion;
      const nextSubmission: Submission = {
        id: response.id,
        assignmentId: response.assignmentId,
        studentId: response.studentId,
        studentName: currentUser.name || 'Student',
        status: response.status,
        submittedAt: response.submittedAt ? new Date(response.submittedAt) : undefined,
        content: typeof payloadRecord.content === 'string' ? payloadRecord.content : undefined,
        files: Array.isArray(payloadRecord.files)
          ? (payloadRecord.files as SubmissionFile[])
          : undefined,
        version: responseVersion,
        rawPayload: responsePayload,
      };

      setLocalSubmission(nextSubmission);
      setSubmissionContent('');
      setUploadedFiles([]);
      setIsUploadBusy(false);
      if (mode === 'submitted') {
        setIeltsAttempt(createInitialStudentIeltsAttempt());
      }
      toast.success(mode === 'draft' ? 'Draft saved.' : 'Assignment submitted successfully!');
      setShowSubmitDialog(false);
    } catch (errorValue) {
      toast.error(
        errorValue instanceof Error ? errorValue.message : 'Unable to submit assignment.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };
  const handleSubmit = () => {
    void submitAssignment('submitted');
  };
  const handleSaveDraft = () => {
    void submitAssignment('draft');
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
          <StudentAssignmentHeaderActions
            submission={submission}
            isOverdue={isOverdue}
            canResubmit={canResubmit}
            hasReachedMaxAttempts={hasReachedMaxAttempts}
            onOpenSubmit={() => setShowSubmitDialog(true)}
          />
        }
      />
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-5xl mx-auto space-y-6">
          <StudentAssignmentStatusAlerts
            assignment={assignment}
            dueDate={dueDate}
            submission={submission}
            isOverdue={isOverdue}
            isDueSoon={isDueSoon}
            hasReachedMaxAttempts={hasReachedMaxAttempts}
          />
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <StudentAssignmentDescriptionCard assignment={assignment} />
              {submission && (
                <StudentAssignmentSubmissionSummary assignment={assignment} submission={submission} />
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
        ieltsType={ieltsType}
        ieltsConfig={ieltsConfig}
        ieltsAttempt={ieltsAttempt}
        ieltsNextAttempt={attemptAvailability?.nextAttempt}
        ieltsMaxAttempts={attemptAvailability?.maxAttempts}
        onOpenChange={setShowSubmitDialog}
        onSubmissionContentChange={setSubmissionContent}
        onUploadedFilesChange={setUploadedFiles}
        onUploadBusyChange={setIsUploadBusy}
        onIeltsAttemptChange={setIeltsAttempt}
        onSaveDraft={ieltsType ? handleSaveDraft : undefined}
        onSubmit={handleSubmit}
      />
    </div>
  );
}

