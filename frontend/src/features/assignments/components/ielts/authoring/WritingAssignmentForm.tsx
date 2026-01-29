/**
 * Location: features/assignments/components/ielts/authoring/WritingAssignmentForm.tsx
 * Purpose: Render the writing authoring form per Figma layout.
 * Why: Matches Task 1/Task 2 prompt structure and visual upload.
 */

import { Badge } from '@components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@components/ui/card';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { Textarea } from '@components/ui/textarea';
import type { IeltsWritingConfig } from '@lib/ielts';

type WritingAssignmentFormProps = {
  value: IeltsWritingConfig;
  onChange: (value: IeltsWritingConfig) => void;
  onImageSelect: (file: File | null) => void;
};

export function WritingAssignmentForm({
  value,
  onChange,
  onImageSelect,
}: WritingAssignmentFormProps) {
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
            <Input
              type="file"
              accept="image/*"
              onChange={(event) => onImageSelect(event.target.files?.[0] ?? null)}
            />
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
