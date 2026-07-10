/**
 * Location: features/admin/components/useCmsUnsavedChangesGuard.ts
 * Purpose: Block route and browser exits while the CMS editor has local changes.
 * Why: Navigation must not silently discard an administrator's unsaved work.
 */
import { useEffect } from 'react';
import { useBlocker } from 'react-router-dom';

export function useCmsUnsavedChangesGuard(hasUnsavedChanges: boolean) {
  const blocker = useBlocker(hasUnsavedChanges);

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  return blocker;
}
