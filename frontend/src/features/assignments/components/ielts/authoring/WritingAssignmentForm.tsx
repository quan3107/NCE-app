/**
 * Location: features/assignments/components/ielts/authoring/WritingAssignmentForm.tsx
 * Purpose: Render the writing authoring form per Figma layout.
 * Why: Matches Task 1/Task 2 prompt structure and visual upload with preview.
 */

import { useEffect, useState } from 'react';
import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@components/ui/card';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { Textarea } from '@components/ui/textarea';
import type { IeltsWritingConfig } from '@lib/ielts';
import { Maximize2, Trash2, Upload } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@components/ui/dialog';

type WritingAssignmentFormProps = {
  value: IeltsWritingConfig;
  onChange: (value: IeltsWritingConfig) => void;
  onImageSelect: (file: File | null) => void;
  selectedImageFile?: File | null;
};

export function WritingAssignmentForm({
  value,
  onChange,
  onImageSelect,
  selectedImageFile,
}: WritingAssignmentFormProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  // Create preview URL when file changes
  useEffect(() => {
    if (selectedImageFile) {
      const url = URL.createObjectURL(selectedImageFile);
      setPreviewUrl(url);
      setFileName(selectedImageFile.name);

      return () => {
        URL.revokeObjectURL(url);
      };
    } else {
      setPreviewUrl(null);
      setFileName(null);
    }
  }, [selectedImageFile]);

  const handleRemoveImage = () => {
    onImageSelect(null);
    setPreviewUrl(null);
    setFileName(null);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    onImageSelect(file);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Writing Tasks</CardTitle>
        <CardDescription>Create Task 1 and Task 2 prompts</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Badge>Task 1</Badge>
            <span className="text-sm text-muted-foreground">150 words minimum</span>
          </div>
          <div className="space-y-2">
            <Label>Task 1 Prompt</Label>
            <Textarea
              value={value.task1.prompt}
              onChange={(event) =>
                onChange({
                  ...value,
                  task1: { ...value.task1, prompt: event.target.value },
                })
              }
              placeholder="The chart below shows... / You should spend about 20 minutes on this task..."
              rows={4}
            />
          </div>
          <div className="space-y-2">
            <Label>Visual (Optional - Chart/Graph/Diagram)</Label>
            {!previewUrl ? (
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="flex-1"
                />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="relative inline-block">
                  <img
                    src={previewUrl}
                    alt="Task 1 visual"
                    className="max-h-48 rounded-lg border object-contain"
                  />
                  <div className="absolute top-2 right-2 flex gap-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button size="icon" variant="secondary" className="size-8">
                          <Maximize2 className="size-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl">
                        <DialogHeader>
                          <DialogTitle>Task 1 Visual</DialogTitle>
                          <DialogDescription>{fileName}</DialogDescription>
                        </DialogHeader>
                        <img
                          src={previewUrl}
                          alt="Task 1 visual full size"
                          className="w-full rounded-lg"
                        />
                      </DialogContent>
                    </Dialog>
                    <Button
                      size="icon"
                      variant="destructive"
                      className="size-8"
                      onClick={handleRemoveImage}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">{fileName}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById('image-replace-input')?.click()}
                  >
                    <Upload className="mr-2 size-4" />
                    Replace
                  </Button>
                  <Input
                    id="image-replace-input"
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4 pt-6 border-t">
          <div className="flex items-center gap-2">
            <Badge>Task 2</Badge>
            <span className="text-sm text-muted-foreground">250 words minimum</span>
          </div>
          <div className="space-y-2">
            <Label>Task 2 Prompt</Label>
            <Textarea
              value={value.task2.prompt}
              onChange={(event) =>
                onChange({
                  ...value,
                  task2: { prompt: event.target.value },
                })
              }
              placeholder="Some people believe that... Discuss both views and give your opinion..."
              rows={5}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
