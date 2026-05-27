import type { UploadFile } from '@domain';
import type { UploadStage } from '@features/files/fileUpload';

type ProgressCallback = (progress: number) => void;
type StageCallback = (stage: UploadStage) => void;

const createUploadId = () =>
  globalThis.crypto?.randomUUID?.() ?? `diagram-${Date.now()}-${Math.random()}`;

export const createAuthoringUploadFile = (
  file: File,
  createObjectUrl: (input: File) => string = (input) => URL.createObjectURL(input),
): UploadFile => ({
  id: createUploadId(),
  name: file.name,
  size: file.size,
  mime: file.type,
  url: createObjectUrl(file),
  createdAt: new Date().toISOString(),
});

export const createDiagramImageUploadFn = (
  uploadImage: (file: File) => Promise<UploadFile>,
) => async (
  file: File,
  onProgress: ProgressCallback,
  onStageChange: StageCallback,
): Promise<UploadFile> => {
  onStageChange('uploading');
  const uploadedFile = await uploadImage(file);
  onProgress(100);
  onStageChange('completing');
  return uploadedFile;
};
