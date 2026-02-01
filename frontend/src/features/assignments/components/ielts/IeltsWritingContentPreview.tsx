/**
 * Location: features/assignments/components/ielts/IeltsWritingContentPreview.tsx
 * Purpose: Render IELTS writing tasks with full prompt text.
 * Why: Gives teachers a full preview of Task 1 and Task 2 instructions.
 */

import type { IeltsWritingConfig } from '@lib/ielts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@components/ui/card';

export function IeltsWritingContentPreview({ value }: { value: IeltsWritingConfig }) {
  return (
    <div className="space-y-6">
      <Card className="rounded-[14px]">
        <CardHeader>
          <CardTitle>Task 1</CardTitle>
          <CardDescription>Report writing prompt</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-[12px] bg-muted/20 p-4 text-sm whitespace-pre-wrap">
            {value.task1.prompt || 'No Task 1 prompt yet.'}
          </div>
          {value.task1.imageFileId && (
            <div className="rounded-[12px] border border-dashed p-4 text-sm text-muted-foreground">
              Image reference: {value.task1.imageFileId}
            </div>
          )}
        </CardContent>
      </Card>
      <Card className="rounded-[14px]">
        <CardHeader>
          <CardTitle>Task 2</CardTitle>
          <CardDescription>Essay prompt</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-[12px] bg-muted/20 p-4 text-sm whitespace-pre-wrap">
            {value.task2.prompt || 'No Task 2 prompt yet.'}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
