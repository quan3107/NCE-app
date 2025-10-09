/**
 * Location: features/courses/management/components/dialogs/RubricDialog.tsx
 * Purpose: Allow teachers to adjust rubric weights inside a lightweight dialog.
 * Why: Connects the existing Edit Rubric button to tangible UI without bloating the page shell.
 */

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@components/ui/dialog';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { Button } from '@components/ui/button';

import type { RubricHandlers } from '../../hooks/useTeacherCourseManagement';
import type { RubricState } from '../../types';

type RubricDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rubric: RubricState;
  handlers: RubricHandlers;
};

export function RubricDialog({ open, onOpenChange, rubric, handlers }: RubricDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Rubric</DialogTitle>
          <DialogDescription>Adjust the weighting for each rubric criterion</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {rubric.criteria.map((criterion, index) => (
            <div key={criterion.name} className="space-y-2">
              <Label>{criterion.name}</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={criterion.weight}
                  onChange={(event) => handlers.updateWeight(index, parseInt(event.target.value, 10) || 0)}
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
              <p className="text-sm text-muted-foreground">{criterion.description}</p>
            </div>
          ))}
          <p className="text-sm text-muted-foreground">Total Weight: {rubric.totalWeight}%</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              handlers.save();
            }}
          >
            Save Rubric
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
