/**
 * Location: features/assignments/components/ielts/authoring/WritingVisualUpload.tsx
 * Purpose: Render Task 1 writing visual upload, preview, and visual-type selection.
 * Why: Keeps image-specific markup out of the writing form orchestrator.
 */

import { Maximize2, Trash2, Upload } from 'lucide-react';
import { Button } from '@components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@components/ui/dialog';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@components/ui/select';
import type { IeltsWritingTask1Type } from '@lib/ielts';

type WritingVisualUploadProps = {
  fileName: string | null;
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveImage: () => void;
  onVisualTypeChange: (value: IeltsWritingTask1Type) => void;
  previewUrl: string | null;
  task1TypeOptions: Array<{ value: string; label: string }>;
  visualType?: IeltsWritingTask1Type;
};

export function WritingVisualUpload({
  fileName,
  onFileChange,
  onRemoveImage,
  onVisualTypeChange,
  previewUrl,
  task1TypeOptions,
  visualType,
}: WritingVisualUploadProps) {
  if (!previewUrl) {
    return (
      <div className="flex items-center gap-2">
        <Input type="file" accept="image/*" onChange={onFileChange} className="flex-1" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative inline-block">
        <img src={previewUrl} alt="Task 1 visual" className="max-h-48 rounded-lg border object-contain" />
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
              <img src={previewUrl} alt="Task 1 visual full size" className="w-full rounded-lg" />
            </DialogContent>
          </Dialog>
          <Button size="icon" variant="destructive" className="size-8" onClick={onRemoveImage}>
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
          onChange={onFileChange}
          className="hidden"
        />
      </div>

      <div className="space-y-2 mt-3">
        <Label>Visual Type (Optional)</Label>
        <Select value={visualType || ''} onValueChange={onVisualTypeChange}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select visual type..." />
          </SelectTrigger>
          <SelectContent>
            {task1TypeOptions.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          For your reference only - students won't see this
        </p>
      </div>
    </div>
  );
}
