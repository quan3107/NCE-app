/**
 * Location: features/assignments/components/StudentAssignmentSubmitDialog.tsx
 * Purpose: Render the submission dialog UI for student assignment submissions.
 * Why: Keeps the detail page lean while reusing the same submit form UI.
 */

import { Assignment } from '@lib/mock-data';
import { Button } from '@components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@components/ui/dialog';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { Textarea } from '@components/ui/textarea';
import { Upload } from 'lucide-react';

type StudentAssignmentSubmitDialogProps = {
  assignment: Assignment;
  isOpen: boolean;
  isSubmitting: boolean;
  submissionContent: string;
  onOpenChange: (open: boolean) => void;
  onSubmissionContentChange: (value: string) => void;
  onSubmit: () => void;
};

export function StudentAssignmentSubmitDialog({
  assignment,
  isOpen,
  isSubmitting,
  submissionContent,
  onOpenChange,
  onSubmissionContentChange,
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
          {assignment.type === 'file' && (
            <div className="space-y-2">
              <Label>Upload File</Label>
              <div className="border-2 border-dashed rounded-lg p-8 text-center hover:bg-accent/50 cursor-pointer transition-colors">
                <Upload className="size-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Click to upload or drag and drop</p>
                <p className="text-xs text-muted-foreground mt-1">PDF, DOC, DOCX (max 10MB)</p>
              </div>
            </div>
          )}

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
          <Button onClick={onSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Submitting...' : 'Submit'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
