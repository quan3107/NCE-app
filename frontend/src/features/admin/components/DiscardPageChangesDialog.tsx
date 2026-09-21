/**
 * Location: features/admin/components/DiscardPageChangesDialog.tsx
 * Purpose: Confirm a page switch that would discard local CMS edits.
 * Why: Administrators must explicitly choose when unsaved work is replaced.
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

type DiscardPageChangesDialogProps = {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  description?: string;
  confirmLabel?: string;
};

export function DiscardPageChangesDialog({
  open,
  onCancel,
  onConfirm,
  description = 'Switching pages will discard the edits currently shown in this editor.',
  confirmLabel = 'Discard changes and switch',
}: DiscardPageChangesDialogProps) {
  const opener = useRef<HTMLElement | null>(null);
  return (
    <AlertDialog open={open} onOpenChange={(nextOpen) => !nextOpen && onCancel()}>
      <AlertDialogContent
        onOpenAutoFocus={() => { opener.current = document.activeElement as HTMLElement; }}
        onCloseAutoFocus={(event) => {
          if (opener.current?.isConnected) {
            event.preventDefault();
            opener.current.focus();
          }
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
          <AlertDialogDescription>
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Keep editing</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>{confirmLabel}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
