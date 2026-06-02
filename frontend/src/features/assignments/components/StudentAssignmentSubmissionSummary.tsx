/**
 * Location: features/assignments/components/StudentAssignmentSubmissionSummary.tsx
 * Purpose: Render a student's current submission summary.
 * Why: Keeps the assignment detail page focused on data flow and actions.
 */

import { FileText, Info } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@components/ui/card';
import { Label } from '@components/ui/label';
import type { SubmissionFile, Submission } from '@domain';
import { formatDate, formatFileSize } from '@lib/utils';

type StudentAssignmentSubmissionSummaryProps = {
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
  );
}

export function StudentAssignmentSubmissionSummary({
  submission,
}: StudentAssignmentSubmissionSummaryProps) {
  const submittedLabel = submission.submittedAt
    ? `Submitted ${formatDate(new Date(submission.submittedAt), 'datetime')}`
    : 'Draft saved';

  return (
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
            <SubmissionFiles files={submission.files} />
          )}
          {!submission.content && (!submission.files || submission.files.length === 0) && (
            <p className="text-sm text-muted-foreground">IELTS attempt payload saved.</p>
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
