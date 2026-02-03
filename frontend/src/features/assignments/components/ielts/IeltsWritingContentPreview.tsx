/**
 * Location: features/assignments/components/ielts/IeltsWritingContentPreview.tsx
 * Purpose: Render IELTS writing tasks with full prompt text and sample responses.
 * Why: Gives teachers a full preview of Task 1 and Task 2 instructions, including model answers.
 */

import type { IeltsWritingConfig } from '@lib/ielts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@components/ui/card';
import { Badge } from '@components/ui/badge';
import { BookOpen, Eye, EyeOff, ClipboardList } from 'lucide-react';

type RubricInfo = {
  id: string;
  name: string;
};

export function IeltsWritingContentPreview({ 
  value, 
  rubrics = [] 
}: { 
  value: IeltsWritingConfig;
  rubrics?: RubricInfo[];
}) {
  // Debug logging
  console.log('[IeltsWritingContentPreview] value.task1.rubricId:', value.task1.rubricId);
  console.log('[IeltsWritingContentPreview] value.task2.rubricId:', value.task2.rubricId);
  console.log('[IeltsWritingContentPreview] rubrics array:', rubrics);

  const getRubricName = (rubricId: string | null | undefined) => {
    if (!rubricId) return null;
    const found = rubrics.find(r => r.id === rubricId);
    console.log(`[getRubricName] Looking for rubricId: ${rubricId}, found:`, found);
    return found?.name || null;
  };

  const task1RubricName = getRubricName(value.task1.rubricId);
  const task2RubricName = getRubricName(value.task2.rubricId);

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
          {value.task1.sampleResponse && (
            <div className="rounded-[12px] border border-primary/20 bg-primary/5 p-4">
              <div className="mb-2 flex items-center gap-2">
                <BookOpen className="size-4 text-primary" />
                <span className="text-sm font-medium text-primary">Sample Response</span>
                <Badge variant={value.task1.showSampleToStudents ? 'default' : 'secondary'} className="ml-auto text-xs">
                  {value.task1.showSampleToStudents ? (
                    <><Eye className="mr-1 size-3" /> Visible to students</>
                  ) : (
                    <><EyeOff className="mr-1 size-3" /> Hidden</>
                  )}
                </Badge>
              </div>
              <div className="text-sm whitespace-pre-wrap text-muted-foreground">
                {value.task1.sampleResponse}
              </div>
            </div>
          )}
          <div className="rounded-[12px] border border-muted bg-muted/10 p-4">
            <div className="mb-2 flex items-center gap-2">
              <ClipboardList className="size-4 text-muted-foreground" />
              <span className="text-sm font-medium">Grading Rubric</span>
            </div>
            <div className="text-sm text-muted-foreground">
              {task1RubricName || 'No rubric selected'}
            </div>
          </div>
        </CardContent>
      </Card>
      <Card className="rounded-[14px]">
        <CardHeader>
          <CardTitle>Task 2</CardTitle>
          <CardDescription>Essay prompt</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-[12px] bg-muted/20 p-4 text-sm whitespace-pre-wrap">
            {value.task2.prompt || 'No Task 2 prompt yet.'}
          </div>
          {value.task2.sampleResponse && (
            <div className="rounded-[12px] border border-primary/20 bg-primary/5 p-4">
              <div className="mb-2 flex items-center gap-2">
                <BookOpen className="size-4 text-primary" />
                <span className="text-sm font-medium text-primary">Sample Response</span>
                <Badge variant={value.task2.showSampleToStudents ? 'default' : 'secondary'} className="ml-auto text-xs">
                  {value.task2.showSampleToStudents ? (
                    <><Eye className="mr-1 size-3" /> Visible to students</>
                  ) : (
                    <><EyeOff className="mr-1 size-3" /> Hidden</>
                  )}
                </Badge>
              </div>
              <div className="text-sm whitespace-pre-wrap text-muted-foreground">
                {value.task2.sampleResponse}
              </div>
            </div>
          )}
          <div className="rounded-[12px] border border-muted bg-muted/10 p-4">
            <div className="mb-2 flex items-center gap-2">
              <ClipboardList className="size-4 text-muted-foreground" />
              <span className="text-sm font-medium">Grading Rubric</span>
            </div>
            <div className="text-sm text-muted-foreground">
              {task2RubricName || 'No rubric selected'}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
