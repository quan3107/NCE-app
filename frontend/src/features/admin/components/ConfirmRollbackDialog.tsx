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
import { useRef } from 'react';

type ConfirmRollbackDialogProps = {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  isBusy?: boolean;
  error?: unknown;
};

export function ConfirmRollbackDialog({
  open,
  onCancel,
  onConfirm,
  isBusy = false,
  error,
}: ConfirmRollbackDialogProps) {
  const opener = useRef<HTMLElement | null>(null);
  return (
    <AlertDialog open={open} onOpenChange={(nextOpen) => !nextOpen && onCancel()}>
      <AlertDialogContent
        onOpenAutoFocus={() => { opener.current = document.activeElement as HTMLElement; }}
        onCloseAutoFocus={(event) => {
          if (opener.current) {
            event.preventDefault();
            const restoreFocus = () => {
              // Refreshing revisions may replace the original trigger node.
              const target = opener.current?.id
                ? document.getElementById(opener.current.id) : opener.current;
              if (target?.isConnected) target.focus();
            };
            restoreFocus();
            requestAnimationFrame(restoreFocus);
          }
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>Publish this historical revision?</AlertDialogTitle>
          <AlertDialogDescription>
            Rollback publishes the selected revision and replaces the current saved draft.
            Concurrent draft changes will be rejected.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? <p role="alert" className="text-sm text-destructive">{error instanceof Error ? error.message : 'Rollback failed. Please try again.'}</p> : null}
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction disabled={isBusy} onClick={(event) => {
            event.preventDefault();
            onConfirm();
          }}>{isBusy ? 'Rolling back…' : 'Confirm rollback'}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
