/**
 * Location: features/assignments/components/StudentAssignmentSubmissionSummary.tsx
 * Purpose: Render a student's current submission summary.
 * Why: Keeps the assignment detail page focused on data flow and actions.
 */

import { FileText, Info } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@components/ui/card';
import { Label } from '@components/ui/label';
import type { Assignment, SubmissionFile, Submission } from '@domain';
import { FileDownloadButton } from '@features/files/FileDownloadButton';
import { isIeltsAssignmentType } from '@lib/ielts';
import { formatDate, formatFileSize } from '@lib/utils';
import { IeltsSubmissionPayloadView } from './IeltsSubmissionPayloadView';

type StudentAssignmentSubmissionSummaryProps = {
  assignment: Assignment;
  submission: Submission;
};

function SubmissionFiles({ files }: { files: SubmissionFile[] }) {
  return (
    <div>
      <Label>Files</Label>
      <div className="mt-2 space-y-2">
        {files.map(file => (
          <div key={file.id} className="flex items-center gap-2 text-sm">
            <FileText className="size-4 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">
                {formatFileSize(file.size)} · {file.mime}
              </p>
            </div>
            <FileDownloadButton file={file} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function StudentAssignmentSubmissionSummary({
  assignment,
  submission,
}: StudentAssignmentSubmissionSummaryProps) {
  const submittedLabel = submission.submittedAt
    ? `Submitted ${formatDate(new Date(submission.submittedAt), 'datetime')}`
    : 'Draft saved';
  const hasIeltsPayload = isIeltsAssignmentType(assignment.type) && submission.rawPayload;
  const hasLegacyContent = Boolean(submission.content);
  const hasFiles = Boolean(submission.files?.length);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your Submission</CardTitle>
        <CardDescription>Submitted work and history</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 bg-muted/50 rounded-lg">
          {hasIeltsPayload && (
            <IeltsSubmissionPayloadView assignment={assignment} payload={submission.rawPayload} />
          )}
          {submission.content && (
            <div>
              <Label>Content</Label>
              <p className="mt-2 text-sm whitespace-pre-wrap">{submission.content}</p>
            </div>
          )}
          {submission.files && submission.files.length > 0 && (
            <SubmissionFiles files={submission.files} />
          )}
          {!hasIeltsPayload && !hasLegacyContent && !hasFiles && (
            <p className="text-sm text-muted-foreground">No displayable submission content.</p>
          )}
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Info className="size-4" />
          <span>
            {submittedLabel} · Version {submission.version}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
