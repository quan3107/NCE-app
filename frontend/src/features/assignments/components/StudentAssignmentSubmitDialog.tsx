/**
 * Location: features/assignments/components/StudentAssignmentSubmitDialog.tsx
 * Purpose: Render the submission dialog UI for student assignment submissions.
 * Why: Keeps the detail page lean while reusing the same submit form UI.
 */

import type { Assignment, SubmissionFile } from '@domain';
import { Button } from '@components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@components/ui/dialog';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { Textarea } from '@components/ui/textarea';
import { FileUploader } from '@components/common/FileUploader';
import { StudentIeltsAttemptForm } from '@features/assignments/components/ielts/student/StudentIeltsAttemptForm';
import type { IeltsAssignmentConfig, IeltsAssignmentType } from '@lib/ielts';
import type { StudentIeltsAttemptState } from './ielts/student/studentIeltsAttempt.logic';

type StudentAssignmentSubmitDialogProps = {
  assignment: Assignment;
  isOpen: boolean;
  isSubmitting: boolean;
  isUploadBusy: boolean;
  submissionContent: string;
  uploadedFiles: SubmissionFile[];
  ieltsType?: IeltsAssignmentType;
  ieltsConfig?: IeltsAssignmentConfig | null;
  ieltsAttempt?: StudentIeltsAttemptState;
  ieltsNextAttempt?: number;
  ieltsMaxAttempts?: number | null;
  onOpenChange: (open: boolean) => void;
  onSubmissionContentChange: (value: string) => void;
  onUploadedFilesChange: (files: SubmissionFile[]) => void;
  onUploadBusyChange: (busy: boolean) => void;
  onIeltsAttemptChange?: (attempt: StudentIeltsAttemptState) => void;
  onSaveDraft?: () => void;
  onSubmit: () => void;
};

export function StudentAssignmentSubmitDialog({
  assignment,
  isOpen,
  isSubmitting,
  isUploadBusy,
  submissionContent,
  uploadedFiles,
  ieltsType,
  ieltsConfig,
  ieltsAttempt,
  ieltsNextAttempt = 1,
  ieltsMaxAttempts = null,
  onOpenChange,
  onSubmissionContentChange,
  onUploadedFilesChange,
  onUploadBusyChange,
  onIeltsAttemptChange,
  onSaveDraft,
  onSubmit,
}: StudentAssignmentSubmitDialogProps) {
  const ieltsForm =
    ieltsType && ieltsConfig && ieltsAttempt && onIeltsAttemptChange
      ? {
          type: ieltsType,
          config: ieltsConfig,
          attempt: ieltsAttempt,
          onChange: onIeltsAttemptChange,
        }
      : null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{ieltsForm ? 'IELTS Attempt' : 'Submit Assignment'}</DialogTitle>
          <DialogDescription>
            Submit your work for {assignment.title}
          </DialogDescription>
        </DialogHeader>

        {ieltsForm ? (
          <StudentIeltsAttemptForm
            type={ieltsForm.type}
            config={ieltsForm.config}
            attempt={ieltsForm.attempt}
            nextAttempt={ieltsNextAttempt}
            maxAttempts={ieltsMaxAttempts}
            onChange={ieltsForm.onChange}
          />
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Upload Files</Label>
              <FileUploader
                value={uploadedFiles}
                onChange={onUploadedFilesChange}
                onBusyChange={onUploadBusyChange}
              />
            </div>

            {assignment.type === 'link' && (
              <div className="space-y-2">
                <Label htmlFor="link">Submission Link</Label>
                <Input
                  id="link"
                  placeholder="https://..."
                  value={submissionContent}
                  onChange={(event) => onSubmissionContentChange(event.target.value)}
                />
              </div>
            )}

            {assignment.type === 'text' && (
              <div className="space-y-2">
                <Label htmlFor="text">Your Response</Label>
                <Textarea
                  id="text"
                  placeholder="Type your response here..."
                  rows={8}
                  value={submissionContent}
                  onChange={(event) => onSubmissionContentChange(event.target.value)}
                />
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {ieltsForm && onSaveDraft && (
            <Button
              variant="outline"
              onClick={onSaveDraft}
              disabled={isSubmitting || isUploadBusy}
            >
              Save Draft
            </Button>
          )}
          <Button onClick={onSubmit} disabled={isSubmitting || isUploadBusy}>
            {isSubmitting ? 'Submitting...' : isUploadBusy ? 'Uploading...' : 'Submit'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
