/**
 * Location: features/files/fileUpload.ts
 * Purpose: Provide helpers for signing, uploading, and completing file uploads.
 * Why: Centralizes pre-signed upload flow while sharing policy exports for callers.
 */

import { apiClient } from '@lib/apiClient';
import type { SubmissionFile } from '@lib/mock-data';

export {
  FALLBACK_FILE_UPLOAD_POLICY,
  createFileUploadPolicy,
  isAllowedFile,
} from './uploadPolicy';
export type {
  FileUploadAllowedType,
  FileUploadLimits,
  FileUploadPolicy,
} from './uploadPolicy';

type FileSignRequest = {
  fileName: string;
  mime: string;
  size: number;
  checksum?: string;
};

type FileSignResponse = {
  uploadUrl: string;
  method: string;
  headers: Record<string, string>;
  bucket: string;
  objectKey: string;
  expiresAt: string;
};

type FileCompleteRequest = {
  bucket: string;
  objectKey: string;
  mime: string;
  size: number;
  checksum: string;
};

type FileCompleteResponse = {
  id: string;
  bucket: string;
  objectKey: string;
  mime: string;
  size: number;
  checksum: string;
};

export type UploadStage = 'hashing' | 'signing' | 'uploading' | 'completing';

const toHex = (buffer: ArrayBuffer): string =>
  Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

export async function computeFileChecksum(file: Blob): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Unable to compute file checksum in this browser.');
  }

  const buffer = await file.arrayBuffer();
  const hash = await globalThis.crypto.subtle.digest('SHA-256', buffer);
  return toHex(hash);
}

async function signFileUpload(payload: FileSignRequest): Promise<FileSignResponse> {
  return apiClient<FileSignResponse, FileSignRequest>('/files/sign', {
    method: 'POST',
    body: payload,
  });
}

async function completeFileUpload(
  payload: FileCompleteRequest,
): Promise<FileCompleteResponse> {
  return apiClient<FileCompleteResponse, FileCompleteRequest>('/files/complete', {
    method: 'POST',
    body: payload,
  });
}

function uploadToSignedUrl({
  uploadUrl,
  method,
  headers,
  file,
  onProgress,
}: {
  uploadUrl: string;
  method: string;
  headers: Record<string, string>;
  file: File;
  onProgress: (progress: number) => void;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, uploadUrl);

    Object.entries(headers ?? {}).forEach(([key, value]) => {
      xhr.setRequestHeader(key, value);
    });

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onerror = () => reject(new Error('Upload failed. Please try again.'));
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }
      reject(new Error(`Upload failed with status ${xhr.status}.`));
    };

    xhr.send(file);
  });
}

export async function uploadFileWithProgress({
  file,
  onProgress,
  onStageChange,
}: {
  file: File;
  onProgress: (progress: number) => void;
  onStageChange?: (stage: UploadStage) => void;
}): Promise<SubmissionFile> {
  const mime = file.type || 'application/octet-stream';

  onProgress(0);
  onStageChange?.('hashing');
  const checksum = await computeFileChecksum(file);

  onStageChange?.('signing');
  const signed = await signFileUpload({
    fileName: file.name,
    mime,
    size: file.size,
    checksum,
  });

  onStageChange?.('uploading');
  await uploadToSignedUrl({
    uploadUrl: signed.uploadUrl,
    method: signed.method || 'PUT',
    headers: signed.headers ?? {},
    file,
    onProgress,
  });

  onStageChange?.('completing');
  const completed = await completeFileUpload({
    bucket: signed.bucket,
    objectKey: signed.objectKey,
    mime,
    size: file.size,
    checksum,
  });

  onProgress(100);

  return {
    id: completed.id,
    name: file.name,
    size: completed.size,
    mime: completed.mime,
    checksum: completed.checksum,
    bucket: completed.bucket,
    objectKey: completed.objectKey,
  };
}
