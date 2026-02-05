/**
 * Location: features/assignments/components/ielts/IeltsWritingContentEditor.tsx
 * Purpose: Full-featured inline editor for IELTS writing tasks (Task 1 and Task 2).
 * Why: Provides comprehensive editing capabilities including rubric selection, sample responses,
 *      visual uploads, and timing controls. Rewritten to use WritingAssignmentForm components
 *      for consistency between creation and editing workflows.
 */

import { useState, useCallback } from 'react';
import type { IeltsWritingConfig } from '@lib/ielts';
import { WritingAssignmentForm } from './authoring/WritingAssignmentForm';
import { uploadFileWithProgress } from '@features/files/fileUpload';
import { toast } from 'sonner@2.0.3';

type IeltsWritingContentEditorProps = {
  value: IeltsWritingConfig;
  onChange: (updated: IeltsWritingConfig) => void;
  courseId: string;
  onManageRubrics: () => void;
};

export function IeltsWritingContentEditor({
  value,
  onChange,
  courseId,
  onManageRubrics,
}: IeltsWritingContentEditorProps) {
  // Local state for image upload
  const [writingTask1File, setWritingTask1File] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Handle image file selection
  const handleImageSelect = useCallback((file: File | null) => {
    setWritingTask1File(file);
  }, []);

  // Upload image and update config
  const uploadImage = useCallback(async (): Promise<string | null> => {
    if (!writingTask1File) {
      return value.task1.imageFileId || null;
    }

    setIsUploading(true);
    try {
      const uploaded = await uploadFileWithProgress({
        file: writingTask1File,
        onProgress: () => undefined,
      });
      return uploaded.id;
    } catch (error) {
      toast.error('Failed to upload image');
      throw error;
    } finally {
      setIsUploading(false);
    }
  }, [writingTask1File, value.task1.imageFileId]);

  // Handle form changes with optional image upload
  const handleFormChange = useCallback(
    async (updatedValue: IeltsWritingConfig) => {
      // If a new image was selected, upload it first
      if (writingTask1File) {
        try {
          const imageFileId = await uploadImage();
          onChange({
            ...updatedValue,
            task1: {
              ...updatedValue.task1,
              imageFileId,
            },
          });
          // Clear the file after successful upload
          setWritingTask1File(null);
        } catch {
          // Error already toasted in uploadImage
          return;
        }
      } else {
        onChange(updatedValue);
      }
    },
    [writingTask1File, uploadImage, onChange]
  );

  return (
    <div className="space-y-6">
      <WritingAssignmentForm
        value={value}
        onChange={handleFormChange}
        onImageSelect={handleImageSelect}
        selectedImageFile={writingTask1File}
        courseId={courseId}
        onManageRubrics={onManageRubrics}
      />
      {isUploading && (
        <div className="text-sm text-muted-foreground text-center">
          Uploading image...
        </div>
      )}
    </div>
  );
}
