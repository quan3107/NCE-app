/**
 * Location: components/common/FileUploader.tsx
 * Purpose: Provide a reusable file upload UI with progress and validation.
 * Why: Keeps the pre-signed upload UX consistent across submission flows.
 */

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { UploadCloud, FileText, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { toast } from 'sonner@2.0.3';

import { Button } from '@components/ui/button';
import { Progress } from '@components/ui/progress';
import { cn } from '@components/ui/utils';
import { formatFileSize } from '@lib/utils';
import type { SubmissionFile } from '@lib/mock-data';
import {
  FILE_UPLOAD_ACCEPT,
  FILE_UPLOAD_LABEL,
  UploadStage,
  isAllowedFile,
  uploadFileWithProgress,
} from '@features/files/fileUpload';

type UploadStatus = UploadStage | 'error';

type UploadItem = {
  id: string;
  file: File;
  progress: number;
  status: UploadStatus;
  error?: string;
};

type FileUploaderProps = {
  value: SubmissionFile[];
  onChange: (files: SubmissionFile[]) => void;
  onBusyChange?: (busy: boolean) => void;
  maxFileSize: number;
  maxTotalSize: number;
};

const stageLabels: Record<UploadStatus, string> = {
  hashing: 'Preparing',
  signing: 'Signing',
  uploading: 'Uploading',
  completing: 'Finalizing',
  error: 'Failed',
};

const createUploadId = (): string => {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `upload-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export function FileUploader({
  value,
  onChange,
  onBusyChange,
  maxFileSize,
  maxTotalSize,
}: FileUploaderProps) {
  const inputId = useId();
  const helperId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const valueRef = useRef(value);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const totalSize = useMemo(() => {
    const uploadedSize = value.reduce((sum, file) => sum + file.size, 0);
    const pendingSize = uploads
      .filter((item) => item.status !== 'error')
      .reduce((sum, item) => sum + item.file.size, 0);
    return uploadedSize + pendingSize;
  }, [uploads, value]);

  const isBusy = useMemo(
    () => uploads.some((item) => item.status !== 'error'),
    [uploads],
  );

  useEffect(() => {
    onBusyChange?.(isBusy);
  }, [isBusy, onBusyChange]);

  const updateUpload = (id: string, patch: Partial<UploadItem>) => {
    setUploads((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  };

  const removeUpload = (id: string) => {
    setUploads((prev) => prev.filter((item) => item.id !== id));
  };

  const removeCompletedFile = (id: string) => {
    onChange(value.filter((file) => file.id !== id));
  };

  const handleUpload = async (uploadId: string, file: File) => {
    try {
      const result = await uploadFileWithProgress({
        file,
        onProgress: (progress) => updateUpload(uploadId, { progress }),
        onStageChange: (stage) =>
          updateUpload(uploadId, { status: stage }),
      });

      const nextFiles = [...valueRef.current, result];
      onChange(nextFiles);
      removeUpload(uploadId);
    } catch (error) {
      updateUpload(uploadId, {
        status: 'error',
        error: error instanceof Error ? error.message : 'Upload failed.',
      });
    }
  };

  const addFiles = (files: FileList | File[]) => {
    const selected = Array.from(files);
    if (!selected.length) {
      return;
    }

    let runningTotal = totalSize;

    selected.forEach((file) => {
      const { ok, reason } = isAllowedFile(file);
      if (!ok) {
        toast.error(reason ?? 'Unsupported file type.');
        return;
      }

      if (file.size > maxFileSize) {
        toast.error(
          `${file.name} exceeds the ${formatFileSize(maxFileSize)} per-file limit.`,
        );
        return;
      }

      if (runningTotal + file.size > maxTotalSize) {
        toast.error(
          `Total upload size cannot exceed ${formatFileSize(maxTotalSize)}.`,
        );
        return;
      }

      runningTotal += file.size;

      const uploadId = createUploadId();
      setUploads((prev) => [
        ...prev,
        { id: uploadId, file, progress: 0, status: 'hashing' },
      ]);
      void handleUpload(uploadId, file);
    });
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      addFiles(event.target.files);
      event.target.value = '';
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    if (event.dataTransfer.files) {
      addFiles(event.dataTransfer.files);
    }
  };

  const handleBrowseClick = () => {
    inputRef.current?.click();
  };

  return (
    <div className="space-y-3">
      <input
        type="file"
        className="sr-only"
        id={inputId}
        ref={inputRef}
        aria-describedby={helperId}
        accept={FILE_UPLOAD_ACCEPT}
        multiple
        tabIndex={-1}
        aria-hidden="true"
        onChange={handleInputChange}
      />

      <div
        className={cn(
          'border-2 border-dashed rounded-lg p-6 text-center transition-colors',
          isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/30',
        )}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <UploadCloud className="size-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Drag and drop files, or{' '}
          <button
            type="button"
            onClick={handleBrowseClick}
            className="text-primary underline underline-offset-4 cursor-pointer"
          >
            browse
          </button>
        </p>
        <p id={helperId} className="text-xs text-muted-foreground mt-1">
          {FILE_UPLOAD_LABEL} · {formatFileSize(maxFileSize)} max per file ·{' '}
          {formatFileSize(maxTotalSize)} total
        </p>
      </div>

      {(value.length > 0 || uploads.length > 0) && (
        <div className="space-y-2">
          {value.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-3 rounded-md border border-muted-foreground/20 p-3"
            >
              <CheckCircle2 className="size-4 text-green-600" />
              <div className="flex-1">
                <p className="text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(file.size)} · {file.mime}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeCompletedFile(file.id)}
                aria-label={`Remove ${file.name}`}
              >
                <X className="size-4" />
              </Button>
            </div>
          ))}

          {uploads.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 rounded-md border border-muted-foreground/20 p-3"
            >
              {item.status === 'error' ? (
                <AlertCircle className="size-4 text-destructive" />
              ) : (
                <FileText className="size-4 text-muted-foreground" />
              )}
              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{item.file.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {item.status === 'error' ? stageLabels.error : stageLabels[item.status]}
                  </span>
                </div>
                <Progress value={item.status === 'error' ? 0 : item.progress} />
                <div className="text-xs text-muted-foreground">
                  {item.status === 'error'
                    ? item.error ?? 'Upload failed.'
                    : formatFileSize(item.file.size)}
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeUpload(item.id)}
                aria-label={`Remove ${item.file.name}`}
                disabled={item.status !== 'error'}
              >
                <X className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
