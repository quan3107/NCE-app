/**
 * Location: features/assignments/components/ielts/WritingBuilder.tsx
 * Purpose: Render the IELTS Writing authoring form (Task 1 + Task 2).
 * Why: Supports prompt editing and optional Task 1 visual upload.
 */

import { useState } from 'react';

import { Card } from '@components/ui/card';
import { Label } from '@components/ui/label';
import { Textarea } from '@components/ui/textarea';
import { RichTextEditor } from '@components/ui/rich-text-editor';
import type { IeltsWritingConfig } from '@lib/ielts';
import type { UploadFile } from '@lib/mock-data';
import { FILE_UPLOAD_LIMITS } from '@features/files/fileUpload';
import { FileUploader } from '@components/common/FileUploader';

type WritingBuilderProps = {
  value: IeltsWritingConfig;
  onChange: (value: IeltsWritingConfig) => void;
};

export function WritingBuilder({ value, onChange }: WritingBuilderProps) {
  const [task1Files, setTask1Files] = useState<UploadFile[]>([]);

  const handleTask1Files = (files: UploadFile[]) => {
    setTask1Files(files);
    onChange({
      ...value,
      task1: {
        ...value.task1,
        imageFileId: files[0]?.id ?? null,
      },
    });
  };

  return (
    <div className="space-y-6">
      <Card className="p-6 border-2 bg-card shadow-sm space-y-5">
        <div className="flex items-center gap-3 pb-3 border-b">
          <span className="section-badge">1</span>
          <h3 className="text-lg font-semibold">Task 1</h3>
        </div>
        
        <div className="space-y-3">
          <Label className="text-sm font-medium">Task 1 Prompt</Label>
          <RichTextEditor
            value={value.task1.prompt}
            onChange={(prompt) =>
              onChange({
                ...value,
                task1: { ...value.task1, prompt },
              })
            }
            placeholder="Describe the chart, graph, or process students must analyze."
          />
        </div>

        <div className="space-y-3">
          <Label className="text-sm font-medium">Task 1 Visual (optional)</Label>
          {value.task1.imageFileId && task1Files.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Linked image file ID: {value.task1.imageFileId}
            </p>
          )}
          <FileUploader
            value={task1Files}
            onChange={handleTask1Files}
            maxFileSize={FILE_UPLOAD_LIMITS.maxFileSize}
            maxTotalSize={FILE_UPLOAD_LIMITS.maxTotalSize}
          />
          <p className="text-xs text-muted-foreground">
            Upload a chart or diagram for Task 1. Students will see it during the test.
          </p>
        </div>
      </Card>

      <Card className="p-6 border-2 bg-card shadow-sm space-y-5">
        <div className="flex items-center gap-3 pb-3 border-b">
          <span className="section-badge">2</span>
          <h3 className="text-lg font-semibold">Task 2</h3>
        </div>
        
        <div className="space-y-3">
          <Label className="text-sm font-medium">Task 2 Prompt</Label>
          <RichTextEditor
            value={value.task2.prompt}
            onChange={(prompt) =>
              onChange({
                ...value,
                task2: { ...value.task2, prompt },
              })
            }
            placeholder="Write the essay question and required instructions."
          />
        </div>
      </Card>
    </div>
  );
}
