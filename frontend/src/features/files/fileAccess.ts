/**
 * Location: features/files/fileAccess.ts
 * Purpose: Fetch authorized signed download URLs for persisted files.
 * Why: Keeps student and teacher file review buttons on the same backend contract.
 */

import { apiClient } from '@lib/apiClient';
import type { SubmissionFile } from '@domain';

export type SignedFileDownload = {
  url: string;
  method: 'GET';
  headers: Record<string, string>;
  fileName: string;
  mime: string;
  size: number;
  expiresAt: string;
};

export type FileOpenTarget = (
  url: string,
  target: string,
  features: string,
) => Window | null;

export async function requestSignedFileDownload(
  fileId: string,
): Promise<SignedFileDownload> {
  return apiClient<SignedFileDownload>(`/files/${encodeURIComponent(fileId)}/download`);
}

export async function openSignedFileDownload(
  file: Pick<SubmissionFile, 'id'>,
  openTarget: FileOpenTarget = (url, target, features) =>
    globalThis.window?.open(url, target, features) ?? null,
): Promise<SignedFileDownload> {
  const fileWindow = openTarget('about:blank', '_blank', 'noopener,noreferrer');
  if (!fileWindow) {
    throw new Error('Allow popups to open file downloads.');
  }

  const signed = await requestSignedFileDownload(file.id);
  fileWindow.location.href = signed.url;
  return signed;
}
