/**
 * Location: features/assignments/components/StudentAssignmentSubmitDialog.tsx
 * Purpose: Render the submission dialog UI for student assignment submissions.
 * Why: Keeps the detail page lean while reusing the same submit form UI.
 */

import type { Assignment, SubmissionFile } from '@lib/mock-data';
import { Button } from '@components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@components/ui/dialog';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { Textarea } from '@components/ui/textarea';
import { FileUploader } from '@components/common/FileUploader';

type StudentAssignmentSubmitDialogProps = {
  assignment: Assignment;
  isOpen: boolean;
  isSubmitting: boolean;
  isUploadBusy: boolean;
  submissionContent: string;
  uploadedFiles: SubmissionFile[];
  onOpenChange: (open: boolean) => void;
  onSubmissionContentChange: (value: string) => void;
  onUploadedFilesChange: (files: SubmissionFile[]) => void;
  onUploadBusyChange: (busy: boolean) => void;
  onSubmit: () => void;
};

export function StudentAssignmentSubmitDialog({
  assignment,
  isOpen,
  isSubmitting,
  isUploadBusy,
  submissionContent,
  uploadedFiles,
  onOpenChange,
  onSubmissionContentChange,
  onUploadedFilesChange,
  onUploadBusyChange,
  onSubmit,
}: StudentAssignmentSubmitDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Submit Assignment</DialogTitle>
          <DialogDescription>
            Submit your work for {assignment.title}
          </DialogDescription>
        </DialogHeader>

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

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={isSubmitting || isUploadBusy}>
            {isSubmitting ? 'Submitting...' : isUploadBusy ? 'Uploading...' : 'Submit'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
