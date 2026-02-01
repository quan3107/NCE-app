/**
 * Location: features/assignments/components/ielts/IeltsWritingContentEditor.tsx
 * Purpose: Inline editor for IELTS writing tasks (Task 1 and Task 2).
 * Why: Allows teachers to edit writing prompts and manage image references directly.
 */

import type { IeltsWritingConfig } from '@lib/ielts';
import { Textarea } from '@components/ui/textarea';
import { Input } from '@components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@components/ui/card';
import { ImageIcon } from 'lucide-react';

type IeltsWritingContentEditorProps = {
  value: IeltsWritingConfig;
  onChange: (updated: IeltsWritingConfig) => void;
};

export function IeltsWritingContentEditor({ value, onChange }: IeltsWritingContentEditorProps) {
  // Defensive: ensure task1 and task2 exist
  const task1 = value.task1 ?? { prompt: '', imageFileId: null };
  const task2 = value.task2 ?? { prompt: '' };

  return (
    <div className="space-y-6">
      {/* Task 1 Card */}
      <Card className="rounded-[14px]">
        <CardHeader>
          <CardTitle>Task 1</CardTitle>
          <CardDescription>Report writing prompt (150 words)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={task1.prompt}
            onChange={(e) =>
              onChange({
                ...value,
                task1: { ...task1, prompt: e.target.value },
              })
            }
            placeholder="Enter Task 1 prompt (e.g., Describe the chart showing...)"
            className="min-h-[120px] resize-none"
          />
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              Image Reference (Optional)
            </label>
            <div className="flex items-center gap-3">
              <div className="flex-1 rounded-lg border border-dashed border-border p-4 flex items-center gap-3">
                <ImageIcon className="size-5 text-muted-foreground" />
                <div className="flex-1">
              {task1.imageFileId ? (
                <p className="text-sm text-foreground">{task1.imageFileId}</p>
              ) : (
                <p className="text-sm text-muted-foreground">No image attached</p>
              )}
                </div>
              </div>
              <Input
                value={task1.imageFileId || ''}
                onChange={(e) =>
                  onChange({
                    ...value,
                    task1: { ...task1, imageFileId: e.target.value || null },
                  })
                }
                placeholder="Image file ID..."
                className="w-[200px]"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Task 2 Card */}
      <Card className="rounded-[14px]">
        <CardHeader>
          <CardTitle>Task 2</CardTitle>
          <CardDescription>Essay prompt (250 words)</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={task2.prompt}
            onChange={(e) =>
              onChange({
                ...value,
                task2: { prompt: e.target.value },
              })
            }
            placeholder="Enter Task 2 essay prompt (e.g., Some people think that...)"
            className="min-h-[150px] resize-none"
          />
        </CardContent>
      </Card>
    </div>
  );
}
