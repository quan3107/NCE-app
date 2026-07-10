/**
 * Location: features/admin/components/ConfirmRollbackDialog.tsx
 * Purpose: Confirm publishing a historical CMS revision as a rollback.
 * Why: Rollback intentionally replaces both published content and the saved draft.
 */
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@components/ui/alert-dialog';

type ConfirmRollbackDialogProps = {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmRollbackDialog({
  open,
  onCancel,
  onConfirm,
}: ConfirmRollbackDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(nextOpen) => !nextOpen && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Publish this historical revision?</AlertDialogTitle>
          <AlertDialogDescription>
            Rollback publishes the selected revision and replaces the current saved draft.
            Concurrent draft changes will be rejected.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Confirm rollback</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
