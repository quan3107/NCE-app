/**
 * Location: features/files/FileDownloadButton.tsx
 * Purpose: Render a signed-download action for persisted submission files.
 * Why: Reuses authorized file access behavior across student and teacher workflows.
 */

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { Button } from '@components/ui/button';
import type { SubmissionFile } from '@domain';
import { openSignedFileDownload } from './fileAccess';

type FileDownloadButtonProps = {
  file: SubmissionFile;
};

export function FileDownloadButton({ file }: FileDownloadButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = async () => {
    setIsLoading(true);
    setError(null);

    try {
      await openSignedFileDownload(file);
    } catch (errorValue) {
      const message =
        errorValue instanceof Error ? errorValue.message : 'Unable to open file.';
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => {
          void handleDownload();
        }}
        disabled={isLoading}
        aria-label={`Download ${file.name}`}
      >
        {isLoading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Download className="size-4" />
        )}
      </Button>
      {error && (
        <span className="max-w-40 text-right text-xs text-destructive" role="status">
          {error}
        </span>
      )}
    </div>
  );
}

