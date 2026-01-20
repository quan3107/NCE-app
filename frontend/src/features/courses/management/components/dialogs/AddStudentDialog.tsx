/**
 * Location: features/courses/management/components/dialogs/AddStudentDialog.tsx
 * Purpose: Present the add-student dialog with shared form wiring.
 * Why: Keeps dialog markup independent of the TeacherCourseManagement container.
 */

import type { FormEvent } from 'react';

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@components/ui/dialog';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { Button } from '@components/ui/button';
import { Mail } from 'lucide-react';

type AddStudentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  newStudentEmail: string;
  onEmailChange: (value: string) => void;
  isSubmitting: boolean;
  errorMessage: string | null;
  onSubmit: () => Promise<void>;
};

export function AddStudentDialog({
  open,
  onOpenChange,
  newStudentEmail,
  onEmailChange,
  isSubmitting,
  errorMessage,
  onSubmit,
}: AddStudentDialogProps) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void onSubmit();
  };

  const isSendDisabled = isSubmitting || newStudentEmail.trim().length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <DialogHeader>
            <DialogTitle>Add Student to Course</DialogTitle>
            <DialogDescription>Enter the student's email address to send them an invitation</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="add-student-email">Student Email</Label>
            <Input
              id="add-student-email"
              type="email"
              placeholder="student@example.com"
              value={newStudentEmail}
              onChange={(event) => onEmailChange(event.target.value)}
              disabled={isSubmitting}
              aria-invalid={Boolean(errorMessage)}
            />
            {errorMessage ? (
              <p className="text-sm text-destructive" role="alert">
                {errorMessage}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSendDisabled}>
              <Mail className="mr-2 size-4" />
              {isSubmitting ? 'Sending...' : 'Send Invitation'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
