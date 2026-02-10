/**
 * Location: features/assignments/components/ielts/DiagramLabelingEditor.tsx
 * Purpose: Editor for diagram/map labeling questions with multi-image support.
 * Why: Supports uploading diagrams and placing labels on them.
 */

import { useState } from 'react';
import { Plus, Trash2, X, ImageIcon } from 'lucide-react';

import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { Textarea } from '@components/ui/textarea';
import { Card, CardContent } from '@components/ui/card';
import type { DiagramLabel } from '@lib/ielts';
import type { UploadFile } from '@types/domain';
import { FileUploader } from '@components/common/FileUploader';

type DiagramLabelingEditorProps = {
  imageIds: string[];
  labels: DiagramLabel[];
  uploadedImages: Record<string, UploadFile>;
  onImageUpload: (file: File) => Promise<string>;
  onImageRemove: (imageId: string) => void;
  onLabelsChange: (labels: DiagramLabel[]) => void;
  onImageFilesChange: (imageId: string, files: UploadFile[]) => void;
};

export function DiagramLabelingEditor({
  imageIds,
  labels,
  uploadedImages,
  onImageUpload,
  onImageRemove,
  onLabelsChange,
  onImageFilesChange,
}: DiagramLabelingEditorProps) {
  const [uploads, setUploads] = useState<Record<string, UploadFile[]>>({});

  const handleFilesChange = async (imageId: string, files: UploadFile[]) => {
    setUploads((prev) => ({ ...prev, [imageId]: files }));
    onImageFilesChange(imageId, files);
  };

  const addImage = async () => {
    // Create a placeholder ID
    const imageId = crypto.randomUUID();
    // Initialize with empty uploads
    setUploads((prev) => ({ ...prev, [imageId]: [] }));
    // Notify parent
    onImageFilesChange(imageId, []);
  };

  const removeImage = (imageId: string) => {
    setUploads((prev) => {
      const next = { ...prev };
      delete next[imageId];
      return next;
    });
    onImageRemove(imageId);
  };

  const addLabel = () => {
    const nextLetter = String.fromCharCode(65 + labels.length); // A, B, C...
    const newLabel: DiagramLabel = {
      id: crypto.randomUUID(),
      letter: labels.length >= 26 ? `Label ${labels.length + 1}` : nextLetter,
      position: '',
      answer: '',
    };
    onLabelsChange([...labels, newLabel]);
  };

  const updateLabel = (id: string, updates: Partial<DiagramLabel>) => {
    const updatedLabels = labels.map((label) =>
      label.id === id ? { ...label, ...updates } : label
    );
    onLabelsChange(updatedLabels);
  };

  const removeLabel = (id: string) => {
    if (labels.length <= 1) return; // Minimum 1 label
    const updatedLabels = labels.filter((label) => label.id !== id);
    // Re-letter remaining labels
    const reletteredLabels = updatedLabels.map((label, index) => ({
      ...label,
      letter: index >= 26 ? `Label ${index + 1}` : String.fromCharCode(65 + index),
    }));
    onLabelsChange(reletteredLabels);
  };

  // Get all images to display (both from props and local uploads)
  const allImageIds = [...new Set([...imageIds, ...Object.keys(uploads)])];

  return (
    <div className="space-y-4">
      {/* Images Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Diagram/Map Images</Label>
          <Button variant="outline" size="sm" onClick={addImage}>
            <Plus className="size-4 mr-1" />
            Add Image
          </Button>
        </div>

        {allImageIds.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-8 text-center">
              <ImageIcon className="size-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No images added yet. Click "Add Image" to upload.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {allImageIds.map((imageId, index) => {
              const imageFile = uploadedImages[imageId];
              const uploadFiles = uploads[imageId] || [];

              return (
                <Card key={imageId} className="overflow-hidden">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Image {index + 1}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => removeImage(imageId)}
                      >
                        <X className="size-4 text-destructive" />
                      </Button>
                    </div>

                    {imageFile ? (
                      <div className="space-y-2">
                        <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
                          <img
                            src={imageFile.url || '#'}
                            alt={`Diagram ${index + 1}`}
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {imageFile.name}
                        </p>
                      </div>
                    ) : (
                      <FileUploader
                        value={uploadFiles}
                        onChange={(files) => handleFilesChange(imageId, files)}
                      />
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Labels Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Labels</Label>
          <Button variant="outline" size="sm" onClick={addLabel}>
            <Plus className="size-4 mr-1" />
            Add Label
          </Button>
        </div>

        <div className="space-y-2">
          {labels.map((label) => (
            <div
              key={label.id}
              className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg border"
            >
              <div className="flex-shrink-0 w-10 h-10 bg-primary/10 text-primary rounded flex items-center justify-center font-medium">
                {label.letter}
              </div>

              <div className="flex-1 grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Position</label>
                  <Input
                    value={label.position}
                    onChange={(e) =>
                      updateLabel(label.id, { position: e.target.value })
                    }
                    placeholder="e.g., Top left corner"
                    className="text-sm"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Answer</label>
                  <Input
                    value={label.answer}
                    onChange={(e) =>
                      updateLabel(label.id, { answer: e.target.value })
                    }
                    placeholder="What's at this location?"
                    className="text-sm"
                  />
                </div>
              </div>

              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={() => removeLabel(label.id)}
                disabled={labels.length <= 1}
              >
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Instructions */}
      <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg">
        <p className="font-medium mb-1">How to use:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>Upload one or more diagram/map images</li>
          <li>Create labels (A, B, C...) for each location to identify</li>
          <li>Enter position description and the correct answer for each label</li>
          <li>Students will see the image and enter answers for each label</li>
        </ul>
      </div>
    </div>
  );
}
