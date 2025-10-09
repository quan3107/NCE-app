/**
 * Location: features/courses/management/components/dialogs/AddStudentDialog.tsx
 * Purpose: Present the add-student dialog with shared form wiring.
 * Why: Keeps dialog markup independent of the TeacherCourseManagement container.
 */

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
  onSubmit: () => void;
};

export function AddStudentDialog({
  open,
  onOpenChange,
  newStudentEmail,
  onEmailChange,
  onSubmit,
}: AddStudentDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Student to Course</DialogTitle>
          <DialogDescription>Enter the student's email address to send them an invitation</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Student Email</Label>
            <Input
              type="email"
              placeholder="student@example.com"
              value={newStudentEmail}
              onChange={(event) => onEmailChange(event.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSubmit}>
            <Mail className="mr-2 size-4" />
            Send Invitation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
