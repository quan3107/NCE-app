/**
 * Location: components/ui/auto-save-indicator.tsx
 * Purpose: Visual indicator for auto-save status.
 * Why: Provides user feedback about save state without being intrusive.
 */

import { Check, Loader2, AlertCircle, History } from 'lucide-react';
import { cn } from '@components/ui/utils';
import type { SaveStatus } from '@lib/use-auto-save';

interface AutoSaveIndicatorProps {
  status: SaveStatus;
  lastSaved: Date | null;
  draftTimestamp: Date | null;
  isRestoring?: boolean;
  className?: string;
}

export function AutoSaveIndicator({ 
  status, 
  lastSaved, 
  draftTimestamp,
  isRestoring = false,
  className 
}: AutoSaveIndicatorProps) {
  const getContent = () => {
    // Don't show anything during restoration
    if (isRestoring) {
      return null;
    }

    switch (status) {
      case 'saving':
        return (
          <>
            <Loader2 className="size-3.5 animate-spin" />
            <span className="text-xs text-muted-foreground">Saving...</span>
          </>
        );
      case 'saved':
        return (
          <>
            <Check className="size-3.5 text-green-500" />
            <span className="text-xs text-muted-foreground">
              Saved {lastSaved ? formatTime(lastSaved) : ''}
            </span>
          </>
        );
      case 'error':
        return (
          <>
            <AlertCircle className="size-3.5 text-destructive" />
            <span className="text-xs text-destructive">Save failed</span>
          </>
        );
      default:
        return null;
    }
  };

  if (status === 'idle') {
    return null;
  }

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      {getContent()}
    </div>
  );
}

function formatTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);

  if (diffSecs < 5) {
    return 'just now';
  } else if (diffSecs < 60) {
    return `${diffSecs}s ago`;
  } else if (diffMins < 60) {
    return `${diffMins}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else {
    return date.toLocaleDateString();
  }
}
